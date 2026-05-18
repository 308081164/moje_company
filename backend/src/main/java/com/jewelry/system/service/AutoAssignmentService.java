package com.jewelry.system.service;

import com.jewelry.system.entity.ModelerWorkStatus;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.User;
import com.jewelry.system.enums.UserRole;
import com.jewelry.system.enums.UserStatus;
import com.jewelry.system.repository.ModelerWorkStatusRepository;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AutoAssignmentService {

    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final ModelerWorkStatusRepository modelerWorkStatusRepository;
    private final TaskAssignmentService taskAssignmentService;
    private final AuditLogService auditLogService;
    private final WebSocketService webSocketService;

    private final Map<Long, LocalDateTime> lastAssignedTime = new ConcurrentHashMap<>();

    /**
     * 自动分配：售中与设计师仍在建单时分配；建模师、跟单员延后到对应阶段再分配，避免长周期流程中人员离职导致错绑。
     */
    @Transactional
    public void autoAssignAll(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("订单不存在"));

        assignSalesMid(order);
        assignDesigner(order);

        orderRepository.save(order);
        auditLogService.log("ORDER_AUTO_ASSIGN", "ORDER", orderId, "订单自动分配（售中/设计）；建模师与跟单员延后至阶段入口分配");
    }

    /**
     * 订单进入「建模中」阶段时调用：优先保留原建模师（若仍在职且可接单），否则按负载均衡重选。
     */
    @Transactional
    public void ensureModelerAssigned(Order order) {
        User current = order.getModeler();
        if (current != null && isModelerEligibleForAutoAssign(current.getId(), order.getIsB2b())) {
            return;
        }
        Long preferredId = current != null ? current.getId() : null;
        Long picked = resolveModelerUserId(order, preferredId);
        if (picked != null) {
            replaceModeler(order, picked, "进入建模阶段分配建模师");
        } else {
            log.warn("订单 {} 暂无可自动分配的建模师", order.getOrderNumber());
        }
    }

    /**
     * 订单进入「待工艺验证」时调用：为跟单员占位分配（优先原跟单员）。
     */
    @Transactional
    public void ensureTrackerAssigned(Order order) {
        User current = order.getFollowUp();
        if (current != null && isActiveStaffUser(current.getId())) {
            return;
        }
        Long preferredId = current != null ? current.getId() : null;

        List<User> trackers = userRepository.findByRole(UserRole.FOLLOW_UP).stream()
                .filter(u -> UserStatus.ACTIVE.equals(u.getStatus()))
                .collect(Collectors.toList());
        if (trackers.isEmpty()) {
            trackers = userRepository.findByRole(UserRole.ADMIN).stream()
                    .filter(u -> UserStatus.ACTIVE.equals(u.getStatus()))
                    .collect(Collectors.toList());
        }
        if (trackers.isEmpty()) {
            log.warn("订单 {} 暂无可分配的跟单员/管理员", order.getOrderNumber());
            return;
        }

        if (preferredId != null) {
            User pref = userRepository.findById(preferredId).orElse(null);
            if (pref != null && UserStatus.ACTIVE.equals(pref.getStatus())
                    && (UserRole.FOLLOW_UP.equals(pref.getRole()) || UserRole.ADMIN.equals(pref.getRole()))) {
                order.setFollowUp(pref);
                auditLogService.log("ORDER_ASSIGN_TRACKER_STAGE", "ORDER", order.getId(), "进入评审阶段保留原跟单员: " + preferredId);
                return;
            }
        }

        User best = findUserWithLeastWorkload(trackers, "TRACKER");
        if (best != null) {
            order.setFollowUp(best);
            auditLogService.log("ORDER_ASSIGN_TRACKER_STAGE", "ORDER", order.getId(), "进入评审阶段分配跟单员: " + best.getId());
        }
    }

    /**
     * 打回建模等环节时：若当前建模师不可用，则改派并更新订单负责人。
     */
    @Transactional
    public void rebalanceModelerIfInvalid(Order order) {
        User current = order.getModeler();
        if (current != null && isModelerEligibleForAutoAssign(current.getId(), order.getIsB2b())) {
            return;
        }
        Long preferredId = current != null ? current.getId() : null;
        Long picked = resolveModelerUserId(order, preferredId);
        if (picked != null) {
            replaceModeler(order, picked, "打回/复核时发现建模师不可用，已改派");
        }
    }

    private Long resolveModelerUserId(Order order, Long preferredId) {
        if (preferredId != null && isModelerEligibleForAutoAssign(preferredId, order.getIsB2b())) {
            return preferredId;
        }
        Long auto = Boolean.TRUE.equals(order.getIsB2b())
                ? taskAssignmentService.findSuitableModelerForB2B()
                : taskAssignmentService.findSuitableModelerForC2C();
        if (auto != null) {
            return auto;
        }
        // 仅查询已维护 ModelerWorkStatus 的建模师；若库中无工作台记录则上面为空，退化为在职建模师 + 负载
        List<User> modelers = userRepository.findByRole(UserRole.MODELER).stream()
                .filter(u -> UserStatus.ACTIVE.equals(u.getStatus()))
                .filter(u -> isModelerEligibleForAutoAssign(u.getId(), order.getIsB2b()))
                .collect(Collectors.toList());
        if (modelers.isEmpty()) {
            return null;
        }
        User best = findUserWithLeastWorkload(modelers, "MODELER");
        return best != null ? best.getId() : null;
    }

    private void replaceModeler(Order order, Long newModelerUserId, String auditNote) {
        Long oldId = order.getModeler() != null ? order.getModeler().getId() : null;
        if (oldId != null && oldId.equals(newModelerUserId)) {
            return;
        }
        if (oldId != null && isModelerEligibleForAutoAssign(oldId, order.getIsB2b())) {
            taskAssignmentService.decrementModelerTodo(oldId, order.getIsB2b());
        }
        User modeler = userRepository.findById(newModelerUserId)
                .orElseThrow(() -> new IllegalArgumentException("建模师不存在: " + newModelerUserId));
        order.setModeler(modeler);
        order.setAssignedToModelerAt(LocalDateTime.now());
        taskAssignmentService.incrementModelerTodo(newModelerUserId, order.getIsB2b());
        webSocketService.notifyNewOrder(newModelerUserId, order.getId(), order.getOrderNumber());
        auditLogService.log("ORDER_MODELER_REPLACE", "ORDER", order.getId(), auditNote + " -> " + newModelerUserId);
    }

    public boolean isModelerEligibleForAutoAssign(Long userId, Boolean isB2bOrder) {
        if (userId == null) {
            return false;
        }
        User u = userRepository.findById(userId).orElse(null);
        if (u == null || !UserStatus.ACTIVE.equals(u.getStatus()) || !UserRole.MODELER.equals(u.getRole())) {
            return false;
        }
        ModelerWorkStatus st = modelerWorkStatusRepository.findByUserId(userId).orElse(null);
        if (st == null) {
            return true;
        }
        if (Boolean.FALSE.equals(st.getAutoAssignEnabled())) {
            return false;
        }
        if (!ModelerWorkStatus.WorkStatus.AVAILABLE.equals(st.getStatus())) {
            return false;
        }
        ModelerWorkStatus.WorkMode mode = st.getWorkMode();
        if (Boolean.TRUE.equals(isB2bOrder)) {
            return mode == ModelerWorkStatus.WorkMode.AUTO || mode == ModelerWorkStatus.WorkMode.B2B_ONLY;
        }
        return mode == ModelerWorkStatus.WorkMode.AUTO || mode == ModelerWorkStatus.WorkMode.C2C_ONLY;
    }

    private boolean isActiveStaffUser(Long userId) {
        User u = userRepository.findById(userId).orElse(null);
        return u != null && UserStatus.ACTIVE.equals(u.getStatus());
    }

    private void assignSalesMid(Order order) {
        if (order.getSalesMid() != null) {
            return;
        }

        List<User> salesUsers = userRepository.findByRole(UserRole.SALES_MID).stream()
                .filter(u -> UserStatus.ACTIVE.equals(u.getStatus()))
                .collect(Collectors.toList());
        if (salesUsers.isEmpty()) {
            log.warn("没有可用的售中客服");
            return;
        }

        User bestSales = findUserWithLeastWorkload(salesUsers, "SALES");
        if (bestSales != null) {
            order.setSalesMid(bestSales);
            log.info("订单 {} 自动分配售中客服: {}", order.getOrderNumber(), bestSales.getUsername());
        }
    }

    private void assignDesigner(Order order) {
        if (order.getDesigner() != null) {
            return;
        }

        List<User> designers = userRepository.findByRole(UserRole.DESIGNER).stream()
                .filter(u -> UserStatus.ACTIVE.equals(u.getStatus()))
                .collect(Collectors.toList());
        if (designers.isEmpty()) {
            log.warn("没有可用的设计师");
            return;
        }

        User bestDesigner = findUserWithLeastWorkload(designers, "DESIGNER");
        if (bestDesigner != null) {
            order.setDesigner(bestDesigner);
            order.setAssignedToDesignerAt(LocalDateTime.now());
            log.info("订单 {} 自动分配设计师: {}", order.getOrderNumber(), bestDesigner.getUsername());
        }
    }

    private User findUserWithLeastWorkload(List<User> users, String role) {
        User bestUser = null;
        int minWorkload = Integer.MAX_VALUE;

        for (User user : users) {
            int workload = calculateWorkload(user, role);

            LocalDateTime lastAssigned = lastAssignedTime.get(user.getId());
            if (lastAssigned != null &&
                    Duration.between(lastAssigned, LocalDateTime.now()).toMinutes() < 30) {
                workload += 10;
            }

            if (workload < minWorkload) {
                minWorkload = workload;
                bestUser = user;
            }
        }

        if (bestUser != null) {
            lastAssignedTime.put(bestUser.getId(), LocalDateTime.now());
        }

        return bestUser;
    }

    private int calculateWorkload(User user, String role) {
        return switch (role) {
            case "SALES" -> (int) orderRepository.countBySalesMidIdAndStatusIn(user.getId(),
                    List.of(com.jewelry.system.enums.OrderStatus.PENDING_DESIGN,
                            com.jewelry.system.enums.OrderStatus.DESIGNING,
                            com.jewelry.system.enums.OrderStatus.PENDING_MODEL));
            case "DESIGNER" -> (int) orderRepository.countByDesignerIdAndStatusIn(user.getId(),
                    List.of(com.jewelry.system.enums.OrderStatus.PENDING_DESIGN,
                            com.jewelry.system.enums.OrderStatus.DESIGNING));
            case "MODELER" -> (int) orderRepository.countByModelerIdAndStatusIn(user.getId(),
                    List.of(com.jewelry.system.enums.OrderStatus.MODELING,
                            com.jewelry.system.enums.OrderStatus.PENDING_MODEL));
            case "TRACKER" -> (int) orderRepository.countByFollowUpIdAndStatusIn(user.getId(),
                    List.of(com.jewelry.system.enums.OrderStatus.PENDING_REVIEW,
                            com.jewelry.system.enums.OrderStatus.PENDING_PRODUCTION));
            default -> 0;
        };
    }
}
