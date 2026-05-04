package com.jewelry.system.service;

import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.User;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.UserRepository;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class AutoAssignmentService {

    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final ModelerWorkStatusService modelerWorkStatusService;
    private final TaskAssignmentService taskAssignmentService;
    private final AuditLogService auditLogService;
    private final WebSocketService webSocketService;

    // 记录用户最近分配时间，避免频繁分配给同一人
    private final Map<Long, LocalDateTime> lastAssignedTime = new ConcurrentHashMap<>();

    /**
     * 自动分配所有成员到订单
     */
    @Transactional
    public void autoAssignAll(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("订单不存在"));

        // 自动分配售中客服
        assignSalesMid(order);
        
        // 自动分配设计师
        assignDesigner(order);
        
        // 自动分配建模师
        assignModeler(order);
        
        // 自动分配跟单员
        assignTracker(order);

        orderRepository.save(order);
        auditLogService.log("ORDER_AUTO_ASSIGN", "ORDER", orderId, "订单自动分配完成");
    }

    /**
     * 自动分配售中客服 - 基于待处理订单数量
     */
    private void assignSalesMid(Order order) {
        if (order.getSalesMid() != null) {
            return; // 已有分配，跳过
        }
        
        List<User> salesUsers = userRepository.findByRole("SALES");
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

    /**
     * 自动分配设计师 - 基于待处理订单数量
     */
    private void assignDesigner(Order order) {
        if (order.getDesigner() != null) {
            return; // 已有分配，跳过
        }
        
        List<User> designers = userRepository.findByRole("DESIGNER");
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

    /**
     * 自动分配建模师 - 使用现有的智能分配算法
     */
    private void assignModeler(Order order) {
        if (order.getModeler() != null) {
            return; // 已有分配，跳过
        }

        Long modelerId = taskAssignmentService.findSuitableModelerForC2C();
        if (modelerId != null) {
            User modeler = userRepository.getReferenceById(modelerId);
            order.setModeler(modeler);
            order.setAssignedToModelerAt(LocalDateTime.now());
            taskAssignmentService.incrementModelerTodo(modelerId, order.getIsB2b());
            
            // 发送通知
            webSocketService.notifyNewOrder(modelerId, order.getId(), order.getOrderNumber());
            log.info("订单 {} 自动分配建模师: {}", order.getOrderNumber(), modeler.getUsername());
        }
    }

    /**
     * 自动分配跟单员 - 基于待处理订单数量
     */
    private void assignTracker(Order order) {
        if (order.getFollowUp() != null) {
            return; // 已有分配，跳过
        }
        
        List<User> trackers = userRepository.findByRole("TRACKER");
        if (trackers.isEmpty()) {
            // 如果没有跟单员，尝试分配管理员
            trackers = userRepository.findByRole("ADMIN");
        }
        
        if (trackers.isEmpty()) {
            log.warn("没有可用的跟单员");
            return;
        }

        User bestTracker = findUserWithLeastWorkload(trackers, "TRACKER");
        if (bestTracker != null) {
            order.setFollowUp(bestTracker);
            log.info("订单 {} 自动分配跟单员: {}", order.getOrderNumber(), bestTracker.getUsername());
        }
    }

    /**
     * 找到工作量最少的用户
     */
    private User findUserWithLeastWorkload(List<User> users, String role) {
        User bestUser = null;
        int minWorkload = Integer.MAX_VALUE;

        for (User user : users) {
            int workload = calculateWorkload(user, role);
            
            // 检查是否最近刚被分配过（30分钟内）
            LocalDateTime lastAssigned = lastAssignedTime.get(user.getId());
            if (lastAssigned != null && 
                Duration.between(lastAssigned, LocalDateTime.now()).toMinutes() < 30) {
                workload += 10; // 增加权重，避免频繁分配
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

    /**
     * 计算用户工作量
     */
    private int calculateWorkload(User user, String role) {
        // 统计该用户负责的进行中订单数量
        return switch (role) {
            case "SALES" -> (int) orderRepository.countBySalesMidIdAndStatusIn(user.getId(), 
                    List.of(com.jewelry.system.enums.OrderStatus.PENDING_DESIGN, 
                            com.jewelry.system.enums.OrderStatus.DESIGNING,
                            com.jewelry.system.enums.OrderStatus.PENDING_MODEL));
            case "DESIGNER" -> (int) orderRepository.countByDesignerIdAndStatusIn(user.getId(),
                    List.of(com.jewelry.system.enums.OrderStatus.DESIGNING));
            case "MODELER" -> (int) orderRepository.countByModelerIdAndStatusIn(user.getId(),
                    List.of(com.jewelry.system.enums.OrderStatus.MODELING));
            case "TRACKER" -> (int) orderRepository.countByFollowUpIdAndStatusIn(user.getId(),
                    List.of(com.jewelry.system.enums.OrderStatus.PENDING_REVIEW,
                            com.jewelry.system.enums.OrderStatus.PENDING_PRODUCTION));
            default -> 0;
        };
    }
}