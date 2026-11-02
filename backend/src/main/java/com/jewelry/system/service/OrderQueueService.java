package com.jewelry.system.service;

import com.jewelry.system.dto.portal.RushPayResponse;
import com.jewelry.system.entity.Order;
import com.jewelry.system.enums.OrderEventType;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.PortalCustomerOrderBindingRepository;
import com.jewelry.system.security.AccountKind;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * 设计/建模产能排队与 $50 加急优先。
 */
@Service
@RequiredArgsConstructor
public class OrderQueueService {

    public static final BigDecimal RUSH_FEE_USD = new BigDecimal("50.00");
    public static final int TIER_NORMAL = 0;
    public static final int TIER_RUSH = 1;

    /** 仍占用设计/建模产能、计入排队的状态 */
    public static final Set<OrderStatus> QUEUE_STATUSES = EnumSet.of(
            OrderStatus.PENDING_DESIGN,
            OrderStatus.DESIGNING,
            OrderStatus.PENDING_MODEL,
            OrderStatus.MODELING);

    private final OrderRepository orderRepository;
    private final PortalCustomerOrderBindingRepository bindingRepository;
    private final OrderEventService orderEventService;

    private FulfillmentDispatchService fulfillmentDispatchService;

    @Lazy
    @org.springframework.beans.factory.annotation.Autowired
    void setFulfillmentDispatchService(FulfillmentDispatchService fulfillmentDispatchService) {
        this.fulfillmentDispatchService = fulfillmentDispatchService;
    }

    public static boolean isInQueue(Order order) {
        return order != null && order.getStatus() != null && QUEUE_STATUSES.contains(order.getStatus());
    }

    public static boolean isRush(Order order) {
        return order != null && order.getPriorityTier() != null && order.getPriorityTier() >= TIER_RUSH;
    }

    /** 工作台/订单列表：加急置顶，再按入队时间 FIFO */
    public static Pageable rushFirstPageable(Pageable pageable) {
        if (pageable == null) {
            return PageRequest.of(0, 20, rushFirstSort());
        }
        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), rushFirstSort());
    }

    public static Sort rushFirstSort() {
        return Sort.by(
                Sort.Order.desc("priorityTier"),
                Sort.Order.asc("queueEnteredAt").nullsLast(),
                Sort.Order.asc("id"));
    }

    /** 新建订单或重新进入设计/建模阶段时入队 */
    public void enterQueue(Order order) {
        if (order == null) {
            return;
        }
        if (order.getPriorityTier() == null) {
            order.setPriorityTier(TIER_NORMAL);
        }
        order.setQueueEnteredAt(LocalDateTime.now());
    }

    /**
     * 状态进入 PENDING_DESIGN / PENDING_MODEL 时刷新入队时间（同阶段内不重复刷新）。
     */
    public void onStatusChanged(Order order, OrderStatus previous, OrderStatus next) {
        if (order == null || next == null || next == previous) {
            return;
        }
        if (next == OrderStatus.PENDING_DESIGN || next == OrderStatus.PENDING_MODEL) {
            if (previous == null || !QUEUE_STATUSES.contains(previous) || stageOf(previous) != stageOf(next)) {
                enterQueue(order);
            }
        }
    }

    private static int stageOf(OrderStatus status) {
        if (status == OrderStatus.PENDING_DESIGN || status == OrderStatus.DESIGNING) {
            return 1;
        }
        if (status == OrderStatus.PENDING_MODEL || status == OrderStatus.MODELING) {
            return 2;
        }
        return 0;
    }

    @Transactional(readOnly = true)
    public long countAhead(Order order) {
        if (!isInQueue(order) || order.getId() == null) {
            return 0L;
        }
        int tier = order.getPriorityTier() != null ? order.getPriorityTier() : TIER_NORMAL;
        LocalDateTime entered = order.getQueueEnteredAt() != null
                ? order.getQueueEnteredAt()
                : (order.getOrderTime() != null ? order.getOrderTime() : order.getCreatedAt());
        if (entered == null) {
            entered = LocalDateTime.now();
        }
        return orderRepository.countAheadInQueue(QUEUE_STATUSES, tier, entered, order.getId());
    }

    @Transactional(readOnly = true)
    public boolean canPayRush(Order order) {
        if (!isInQueue(order) || isRush(order)) {
            return false;
        }
        if (order.getStatus() == OrderStatus.PENDING_DESIGN && order.getDesigner() != null) {
            return false;
        }
        if (order.getStatus() == OrderStatus.PENDING_MODEL && order.getModeler() != null) {
            return false;
        }
        OrderStatus st = order.getStatus();
        return st == OrderStatus.PENDING_DESIGN || st == OrderStatus.PENDING_MODEL;
    }

    @Transactional
    public RushPayResponse payRush(long orderId) {
        Long accountId = SecurityUtils.currentPortalCustomerId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录"));
        bindingRepository.findByPortalCustomerIdAndOrderId(accountId, orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "无权操作该订单或未绑定"));
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
        if (isRush(order)) {
            return RushPayResponse.builder()
                    .orderId(orderId)
                    .rushPaid(true)
                    .priorityTier(order.getPriorityTier())
                    .queueAheadCount(countAhead(order))
                    .rushFee(RUSH_FEE_USD.stripTrailingZeros().toPlainString())
                    .message("该订单已支付加急费用")
                    .build();
        }
        if (!isInQueue(order)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "当前订单已不在设计/建模排队中，无需加急");
        }
        order.setPriorityTier(TIER_RUSH);
        order.setRushPaidAt(LocalDateTime.now());
        order.setRushFee(RUSH_FEE_USD);
        if (order.getQueueEnteredAt() == null) {
            enterQueue(order);
        }
        orderRepository.save(order);

        String text = "客户已支付加急费用 USD " + RUSH_FEE_USD.stripTrailingZeros().toPlainString()
                + "（模拟）。本单将优先安排设计/建模产能。";
        orderEventService.record(orderId, OrderEventType.RUSH_PAID,
                AccountKind.C_PORTAL_CUSTOMER, accountId, "CUSTOMER",
                "已支付加急费用", text, null, null);

        fulfillmentDispatchService.drainAssignmentQueues();

        return RushPayResponse.builder()
                .orderId(orderId)
                .rushPaid(true)
                .priorityTier(TIER_RUSH)
                .queueAheadCount(countAhead(order))
                .rushFee(RUSH_FEE_USD.stripTrailingZeros().toPlainString())
                .message("加急已生效，我们将优先安排处理")
                .build();
    }

    /** 会话列表比较：加急优先，再按最近消息时间 */
    public static int compareConversationRushThenTime(
            Boolean aRush, java.time.LocalDateTime aTime, Long aId,
            Boolean bRush, java.time.LocalDateTime bTime, Long bId) {
        boolean ar = Boolean.TRUE.equals(aRush);
        boolean br = Boolean.TRUE.equals(bRush);
        if (ar != br) {
            return ar ? -1 : 1;
        }
        java.time.LocalDateTime ta = aTime != null ? aTime : java.time.LocalDateTime.MIN;
        java.time.LocalDateTime tb = bTime != null ? bTime : java.time.LocalDateTime.MIN;
        int cmp = tb.compareTo(ta);
        if (cmp != 0) {
            return cmp;
        }
        long ida = aId != null ? aId : 0L;
        long idb = bId != null ? bId : 0L;
        return Long.compare(idb, ida);
    }

    public List<OrderStatus> queueStatusList() {
        return List.copyOf(QUEUE_STATUSES);
    }
}
