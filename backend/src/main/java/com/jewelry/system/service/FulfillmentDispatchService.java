package com.jewelry.system.service;

import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.User;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.enums.UserRole;
import com.jewelry.system.enums.UserStatus;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 问卷后门禁派单、硬容量 3、加急优先 FIFO。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FulfillmentDispatchService {

    public static final int MAX_CONCURRENT_SLOTS = 3;

    private static final List<OrderStatus> DESIGNER_SLOT_STATUSES = List.of(
            OrderStatus.PENDING_DESIGN,
            OrderStatus.DESIGNING,
            OrderStatus.PENDING_DESIGN_REVIEW);

    private static final List<OrderStatus> MODELER_SLOT_STATUSES = List.of(
            OrderStatus.PENDING_MODEL,
            OrderStatus.MODELING,
            OrderStatus.PENDING_REVIEW);

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final OrderQueueService orderQueueService;
    private final AutoAssignmentService autoAssignmentService;
    private final WebSocketService webSocketService;
    private final AuditLogService auditLogService;

    @Transactional
    public void onBriefSubmitted(long orderId) {
        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null) {
            return;
        }
        orderQueueService.enterQueue(order);
        orderRepository.save(order);
        drainAssignmentQueues();
    }

    @Transactional
    public void drainAssignmentQueues() {
        drainDesignQueue();
        drainModelQueue();
    }

    @Transactional
    public void drainDesignQueue() {
        List<Order> waiting = orderRepository.findAwaitingDesignerWithBriefSubmitted(OrderStatus.PENDING_DESIGN);
        waiting.sort(queueComparator());
        for (Order order : waiting) {
            User designer = pickDesignerWithCapacity();
            if (designer == null) {
                break;
            }
            order.setDesigner(designer);
            order.setAssignedToDesignerAt(LocalDateTime.now());
            orderRepository.save(order);
            autoAssignmentService.notifyDesignerAssigned(order, designer);
            auditLogService.log("ORDER_DISPATCH_DESIGNER", "ORDER", order.getId(),
                    "问卷完成后分配设计师: " + designer.getUsername());
        }
    }

    @Transactional
    public void drainModelQueue() {
        List<Order> waiting = orderRepository.findAwaitingModelerWithBriefSubmitted(OrderStatus.PENDING_MODEL);
        waiting.sort(queueComparator());
        for (Order order : waiting) {
            Long modelerId = pickModelerWithCapacity(order);
            if (modelerId == null) {
                break;
            }
            autoAssignmentService.assignModelerToOrder(order, modelerId, "排队后分配建模师");
            orderRepository.save(order);
        }
    }

    private Long pickModelerWithCapacity(Order order) {
        List<User> modelers = userRepository.findByRole(UserRole.MODELER).stream()
                .filter(u -> UserStatus.ACTIVE.equals(u.getStatus()))
                .filter(u -> autoAssignmentService.isModelerEligibleForAutoAssign(u.getId(), order.getIsB2b()))
                .filter(u -> countModelerSlots(u.getId()) < MAX_CONCURRENT_SLOTS)
                .collect(Collectors.toList());
        if (modelers.isEmpty()) {
            return null;
        }
        User best = null;
        int minSlots = Integer.MAX_VALUE;
        for (User u : modelers) {
            int slots = countModelerSlots(u.getId());
            if (slots < minSlots) {
                minSlots = slots;
                best = u;
            }
        }
        return best != null ? best.getId() : null;
    }

    public int countDesignerSlots(long designerId) {
        return (int) orderRepository.countByDesignerIdAndStatusIn(designerId, DESIGNER_SLOT_STATUSES);
    }

    public int countModelerSlots(long modelerId) {
        return (int) orderRepository.countByModelerIdAndStatusIn(modelerId, MODELER_SLOT_STATUSES);
    }

    private User pickDesignerWithCapacity() {
        List<User> designers = userRepository.findByRole(UserRole.DESIGNER).stream()
                .filter(u -> UserStatus.ACTIVE.equals(u.getStatus()))
                .collect(Collectors.toList());
        User best = null;
        int bestSlots = Integer.MAX_VALUE;
        for (User u : designers) {
            int slots = countDesignerSlots(u.getId());
            if (slots >= MAX_CONCURRENT_SLOTS) {
                continue;
            }
            if (slots < bestSlots) {
                bestSlots = slots;
                best = u;
            }
        }
        return best;
    }

    private static Comparator<Order> queueComparator() {
        return Comparator
                .comparing((Order o) -> o.getPriorityTier() != null ? o.getPriorityTier() : 0).reversed()
                .thenComparing(o -> o.getQueueEnteredAt() != null ? o.getQueueEnteredAt() : o.getCreatedAt(),
                        Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(Order::getId);
    }
}
