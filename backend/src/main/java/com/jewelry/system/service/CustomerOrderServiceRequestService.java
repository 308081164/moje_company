package com.jewelry.system.service;

import com.jewelry.system.dto.order.ServiceRequestResolveRequest;
import com.jewelry.system.dto.portal.CustomerServiceRequestCreateRequest;
import com.jewelry.system.dto.portal.CustomerServiceRequestDto;
import com.jewelry.system.entity.CustomerOrderServiceRequest;
import com.jewelry.system.entity.Order;
import com.jewelry.system.enums.OrderEventType;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.repository.CustomerOrderServiceRequestRepository;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.PortalCustomerOrderBindingRepository;
import com.jewelry.system.security.AccountKind;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class CustomerOrderServiceRequestService {

    public static final String TYPE_COMPLAINT = "COMPLAINT";
    public static final String TYPE_REFUND = "REFUND";

    private static final Set<String> OPEN_STATUSES = Set.of("OPEN", "IN_PROGRESS");
    private static final Set<String> COMPLAINT_CATEGORIES = Set.of(
            "QUALITY", "SERVICE", "DELAY", "SHIPPING", "OTHER");
    private static final Set<String> REFUND_CATEGORIES = Set.of(
            "CHANGE_OF_MIND", "DESIGN_UNSATISFIED", "DELAY", "PRICE", "OTHER");
    /** 生产开始前可优先退款；生产中仍可申请，由客服人工审核 */
    private static final EnumSet<OrderStatus> PREFERRED_REFUND =
            EnumSet.of(
                    OrderStatus.PENDING_DESIGN,
                    OrderStatus.DESIGNING,
                    OrderStatus.PENDING_MODEL,
                    OrderStatus.MODELING,
                    OrderStatus.PENDING_REVIEW,
                    OrderStatus.PENDING_PRODUCTION);

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final CustomerOrderServiceRequestRepository requestRepository;
    private final OrderRepository orderRepository;
    private final PortalCustomerOrderBindingRepository bindingRepository;
    private final OrderEventService orderEventService;

    @Transactional
    public CustomerServiceRequestDto submitComplaint(long orderId, CustomerServiceRequestCreateRequest req) {
        return create(orderId, TYPE_COMPLAINT, req);
    }

    @Transactional
    public CustomerServiceRequestDto submitRefund(long orderId, CustomerServiceRequestCreateRequest req) {
        return create(orderId, TYPE_REFUND, req);
    }

    @Transactional
    public CustomerServiceRequestDto submitRefundForAccount(long orderId, long accountId,
                                                            CustomerServiceRequestCreateRequest req) {
        bindingRepository.findByPortalCustomerIdAndOrderId(accountId, orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "无权操作该订单"));
        return createInternal(orderId, accountId, TYPE_REFUND, req);
    }

    @Transactional(readOnly = true)
    public List<CustomerServiceRequestDto> listForCustomerOrder(long orderId) {
        requireBoundAccount(orderId);
        return requestRepository.findByOrderIdOrderByCreatedAtDesc(orderId).stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CustomerServiceRequestDto> listForStaffOrder(long orderId) {
        return requestRepository.findByOrderIdOrderByCreatedAtDesc(orderId).stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CustomerServiceRequestDto> listOpenForStaff() {
        return requestRepository.findByStatusInOrderByCreatedAtDesc(OPEN_STATUSES).stream()
                .map(this::toDto)
                .toList();
    }

    /**
     * 客户撤销本订单进行中的退款申请（尚未被客服结案时可撤回）。
     */
    @Transactional
    public CustomerServiceRequestDto cancelOpenRefund(long orderId) {
        Long accountId = requireBoundAccount(orderId);
        CustomerOrderServiceRequest row = requestRepository
                .findFirstByOrderIdAndTypeAndStatusIn(orderId, TYPE_REFUND, OPEN_STATUSES)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "没有可撤销的退款申请"));
        if (!Objects.equals(row.getPortalCustomerId(), accountId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权操作该申请");
        }
        row.setStatus("CANCELLED");
        row.setResolvedAt(LocalDateTime.now());
        requestRepository.save(row);
        orderEventService.record(orderId, OrderEventType.SERVICE_REQUEST_CANCELLED,
                AccountKind.C_PORTAL_CUSTOMER, accountId, "CUSTOMER",
                "客户已撤销退款申请", "客户已主动撤销退款申请，订单将继续按原流程处理。", null, null);
        return toDto(row);
    }

    @Transactional
    public CustomerServiceRequestDto resolve(long requestId, ServiceRequestResolveRequest req) {
        Long staffId = SecurityUtils.currentStaffUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录员工账号"));
        String roleApi = SecurityUtils.currentRoleApi().orElse("");
        if (req == null || !StringUtils.hasText(req.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "缺少处理状态");
        }
        String status = req.getStatus().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("IN_PROGRESS", "RESOLVED", "REJECTED").contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "无效的处理状态");
        }
        CustomerOrderServiceRequest row = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "申请不存在"));
        if ("RESOLVED".equals(row.getStatus()) || "REJECTED".equals(row.getStatus())
                || "CANCELLED".equals(row.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该申请已结案");
        }
        // 退款处理仅管理员；投诉可由跟单/客服等员工处理
        if (TYPE_REFUND.equals(row.getType()) && !"ADMIN".equals(roleApi)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可以处理退款申请");
        }
        row.setStatus(status);
        if (StringUtils.hasText(req.getStaffNote())) {
            row.setStaffNote(req.getStaffNote().trim());
        }
        if ("RESOLVED".equals(status) || "REJECTED".equals(status)) {
            row.setResolvedBy(staffId);
            row.setResolvedAt(LocalDateTime.now());
            OrderEventType eventType = "RESOLVED".equals(status)
                    ? OrderEventType.SERVICE_REQUEST_RESOLVED
                    : OrderEventType.SERVICE_REQUEST_REJECTED;
            String title = TYPE_REFUND.equals(row.getType())
                    ? ("RESOLVED".equals(status) ? "已退款" : "退款申请未通过")
                    : ("RESOLVED".equals(status) ? "投诉已处理" : "投诉未通过");
            String content = StringUtils.hasText(row.getStaffNote()) ? row.getStaffNote() : title;
            String actorRole = TYPE_REFUND.equals(row.getType()) ? "ADMIN" : ("ADMIN".equals(roleApi) ? "ADMIN" : "FOLLOW_UP");
            orderEventService.record(row.getOrderId(), eventType, AccountKind.STAFF, staffId, actorRole,
                    title, content, null, null);
            if (TYPE_REFUND.equals(row.getType()) && "RESOLVED".equals(status)) {
                Order order = orderRepository.findById(row.getOrderId()).orElse(null);
                if (order != null && order.getStatus() != OrderStatus.CANCELLED) {
                    order.setStatus(OrderStatus.CANCELLED);
                    orderRepository.save(order);
                }
            }
        }
        requestRepository.save(row);
        return toDto(row);
    }

    private CustomerServiceRequestDto create(long orderId, String type, CustomerServiceRequestCreateRequest req) {
        Long accountId = requireBoundAccount(orderId);
        return createInternal(orderId, accountId, type, req);
    }

    private CustomerServiceRequestDto createInternal(long orderId, long accountId, String type,
                                                     CustomerServiceRequestCreateRequest req) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "订单已取消，无法提交申请");
        }
        if (requestRepository.findFirstByOrderIdAndTypeAndStatusIn(orderId, type, OPEN_STATUSES).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    TYPE_REFUND.equals(type) ? "该订单已有进行中的退款申请" : "该订单已有进行中的投诉");
        }
        if (req == null || !StringUtils.hasText(req.getReason())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请填写申请说明");
        }
        String reason = req.getReason().trim();
        if (reason.length() < 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请至少填写 5 个字的说明");
        }
        if (reason.length() > 2000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "说明过长");
        }
        String category = normalizeCategory(type, req.getCategory());
        BigDecimal amount = null;
        if (TYPE_REFUND.equals(type) && req.getRequestedAmount() != null) {
            if (req.getRequestedAmount().compareTo(BigDecimal.ZERO) <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "退款金额须大于 0");
            }
            amount = req.getRequestedAmount().setScale(2, RoundingMode.HALF_UP);
        }

        CustomerOrderServiceRequest row = new CustomerOrderServiceRequest();
        row.setOrderId(orderId);
        row.setPortalCustomerId(accountId);
        row.setType(type);
        row.setStatus("OPEN");
        row.setCategory(category);
        row.setReason(reason);
        row.setRequestedAmount(amount);
        row = requestRepository.save(row);

        boolean preferred = PREFERRED_REFUND.contains(order.getStatus());
        OrderEventType eventType = TYPE_REFUND.equals(type)
                ? OrderEventType.REFUND_REQUESTED
                : OrderEventType.COMPLAINT_SUBMITTED;
        String title = TYPE_REFUND.equals(type) ? "客户申请退款" : "客户提交投诉";
        StringBuilder content = new StringBuilder();
        if (StringUtils.hasText(category)) {
            content.append("分类：").append(category).append('\n');
        }
        content.append(reason);
        if (amount != null) {
            content.append("\n希望退款：USD ").append(amount);
        }
        if (TYPE_REFUND.equals(type) && !preferred) {
            content.append("\n（订单已进入生产或交付阶段，需人工审核）");
        }
        // reason 字段留给驳回类事件；客户申请说明已写入 content，避免聊天卡误标为「驳回原因」
        orderEventService.record(orderId, eventType, AccountKind.C_PORTAL_CUSTOMER, accountId, "CUSTOMER",
                title, content.toString(), null, null);
        return toDto(row);
    }

    private String normalizeCategory(String type, String raw) {
        if (!StringUtils.hasText(raw)) {
            return "OTHER";
        }
        String cat = raw.trim().toUpperCase(Locale.ROOT);
        Set<String> allowed = TYPE_REFUND.equals(type) ? REFUND_CATEGORIES : COMPLAINT_CATEGORIES;
        if (!allowed.contains(cat)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "无效的申请分类");
        }
        return cat;
    }

    private Long requireBoundAccount(long orderId) {
        Long accountId = SecurityUtils.currentPortalCustomerId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录"));
        bindingRepository.findByPortalCustomerIdAndOrderId(accountId, orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "无权操作该订单或未绑定"));
        return accountId;
    }

    private CustomerServiceRequestDto toDto(CustomerOrderServiceRequest row) {
        String orderNumber = orderRepository.findById(row.getOrderId())
                .map(Order::getOrderNumber)
                .orElse(null);
        return CustomerServiceRequestDto.builder()
                .id(row.getId())
                .orderId(row.getOrderId())
                .orderNumber(orderNumber)
                .type(row.getType())
                .status(row.getStatus())
                .category(row.getCategory())
                .reason(row.getReason())
                .requestedAmount(row.getRequestedAmount())
                .staffNote(row.getStaffNote())
                .createdAt(fmt(row.getCreatedAt()))
                .updatedAt(fmt(row.getUpdatedAt()))
                .resolvedAt(fmt(row.getResolvedAt()))
                .build();
    }

    private static String fmt(LocalDateTime t) {
        return t == null ? null : ISO.format(t);
    }
}
