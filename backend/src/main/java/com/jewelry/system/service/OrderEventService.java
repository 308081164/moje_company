package com.jewelry.system.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.order.OrderEventDto;
import com.jewelry.system.entity.*;
import com.jewelry.system.enums.OrderEventType;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.repository.*;
import com.jewelry.system.security.AccountKind;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 订单事件卡片服务：把设计/建模提交、驳回、评审、报价、跟单、状态变更等关键节点持久化为可展示的卡片。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderEventService {

    private final OrderEventRepository eventRepository;
    private final OrderRepository orderRepository;
    private final OrderRejectionFlowRepository rejectionFlowRepository;
    private final UserRepository userRepository;
    private final PortalCustomerAccountRepository portalCustomerAccountRepository;
    private final B2BClientRepository b2bClientRepository;
    private final WebSocketService webSocketService;
    private final ConversationService conversationService;
    private final OrderEventCardService orderEventCardService;
    private final ObjectMapper objectMapper;

    @Transactional
    public OrderEvent record(Long orderId, OrderEventType type, AccountKind actorType, Long actorId, String actorRole,
                             String title, String content, String reason, List<Long> fileIds) {
        return record(orderId, type, actorType, actorId, actorRole, title, content, reason, fileIds, null, null);
    }

    @Transactional
    public OrderEvent record(Long orderId, OrderEventType type, AccountKind actorType, Long actorId, String actorRole,
                             String title, String content, String reason, List<Long> fileIds,
                             Long pieceId, String snapshotJson) {
        OrderEvent event = new OrderEvent();
        event.setOrderId(orderId);
        event.setPieceId(pieceId);
        event.setEventType(type);
        event.setActorType(actorType);
        event.setActorId(actorId);
        event.setActorRole(actorRole);
        event.setTitle(title);
        event.setContent(content);
        event.setReason(reason);
        event.setFileIdsJson(serializeFileIds(fileIds));
        event.setSnapshotJson(snapshotJson);
        event = eventRepository.save(event);
        if (StringUtils.hasText(title)) {
            conversationService.pushEventMessage(orderId, event.getId(), title, actorType, actorId, actorRole);
        }
        return event;
    }

    /** 是否存在尚未结清的尾款支付请求（有 BALANCE_PAYMENT 且其后无 BALANCE_PAID）。 */
    @Transactional(readOnly = true)
    public boolean hasOpenBalancePayment(long orderId) {
        boolean open = false;
        for (OrderEvent e : eventRepository.findByOrderIdOrderByIdAsc(orderId)) {
            if (e.getEventType() == OrderEventType.BALANCE_PAYMENT) {
                open = true;
            } else if (e.getEventType() == OrderEventType.BALANCE_PAID) {
                open = false;
            }
        }
        return open;
    }

    /** 客户不可见：内部驳回，以及驳回后在内部交回下游的记录。 */
    public static boolean isHiddenFromCustomer(String eventType, String title) {
        if ("REVIEW_REJECT".equals(eventType)) {
            return true;
        }
        if (!"STATUS_CHANGE".equals(eventType) || title == null) {
            return false;
        }
        return "建模师驳回给设计师".equals(title)
                || "设计师已修改并交回建模师".equals(title)
                || "建模师已修改并交回跟单员".equals(title);
    }

    public static boolean isHiddenFromCustomer(OrderEvent event) {
        if (event == null || event.getEventType() == null) {
            return false;
        }
        return isHiddenFromCustomer(event.getEventType().name(), event.getTitle());
    }

    @Transactional(readOnly = true)
    public List<OrderEventDto> listByOrder(Long orderId) {
        return eventRepository.findByOrderIdOrderByIdAsc(orderId).stream()
                .filter(e -> !isHiddenFromCustomer(e))
                .map(this::toDto)
                .toList();
    }

    /**
     * 客户在卡片上驳回（设计稿或建模稿），记录卡片 + 驳回流程 + 状态回退，并通知建模师/设计师。
     */
    @Transactional
    public OrderEventDto rejectByCustomer(Long orderId, OrderEventType type, AccountKind actorType, Long actorId,
                                          String actorRole, String reason) {
        return rejectByCustomer(orderId, type, actorType, actorId, actorRole, reason, null, null);
    }

    @Transactional
    public OrderEventDto rejectByCustomer(Long orderId, OrderEventType type, AccountKind actorType, Long actorId,
                                          String actorRole, String reason, Long pieceId, String title) {
        if (type != OrderEventType.DESIGN_REJECT && type != OrderEventType.MODEL_REJECT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "驳回类型不正确");
        }
        if (!StringUtils.hasText(reason)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "驳回原因不能为空");
        }
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));

        String eventTitle = StringUtils.hasText(title) ? title : type.getDescription();
        OrderEvent event = record(orderId, type, actorType, actorId, actorRole,
                eventTitle, reason, reason, null, pieceId, null);

        OrderRejectionFlow flow = new OrderRejectionFlow();
        flow.setOrderId(orderId);
        flow.setRejectedBy(actorId);
        flow.setRejectionType(type.name());
        flow.setRejectionReasons(reason);
        flow.setCurrentStage("PENDING_FIX");
        flow.setLastStatusUpdateBy(actorId);
        flow.setLastStatusUpdateAt(LocalDateTime.now());
        rejectionFlowRepository.save(flow);

        try {
            if (type == OrderEventType.DESIGN_REJECT) {
                if (order.getStatus() != OrderStatus.DESIGNING && order.getStatus() != OrderStatus.PENDING_DESIGN) {
                    order.transitionTo(OrderStatus.DESIGNING);
                }
            } else {
                if (order.getStatus() != OrderStatus.MODELING) {
                    order.transitionTo(OrderStatus.MODELING);
                }
            }
            orderRepository.save(order);
        } catch (IllegalStateException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }

        webSocketService.notifyOrderStatusChange(order.getId(), order.getStatus().name(), order.getOrderNumber());
        webSocketService.notifyRejection(order.getId(), order.getOrderNumber(), reason);
        return toDto(event);
    }

    private OrderEventDto toDto(OrderEvent event) {
        OrderEventDto dto = orderEventCardService.assemble(event);
        dto.setActorName(resolveActorName(event.getActorType(), event.getActorId()));
        return dto;
    }

    private String resolveActorName(AccountKind type, Long accountId) {
        try {
            return switch (type) {
                case STAFF -> userRepository.findById(accountId)
                        .map(u -> StringUtils.hasText(u.getRealName()) ? u.getRealName() : u.getUsername())
                        .orElse(null);
                case C_PORTAL_CUSTOMER -> portalCustomerAccountRepository.findById(accountId)
                        .map(a -> StringUtils.hasText(a.getDisplayName()) ? a.getDisplayName()
                                : (StringUtils.hasText(a.getEmail()) ? a.getEmail() : a.getContact()))
                        .orElse(null);
                case B2B_CLIENT -> b2bClientRepository.findById(accountId)
                        .map(c -> StringUtils.hasText(c.getCompanyName()) ? c.getCompanyName()
                                : (StringUtils.hasText(c.getContactPerson()) ? c.getContactPerson() : c.getContact()))
                        .orElse(null);
            };
        } catch (Exception e) {
            log.warn("解析事件操作者姓名失败 type={} id={}", type, accountId, e);
            return null;
        }
    }

    /** 客户首次提交收货信息时发确认卡；再次修改则更新同一张卡的内容。 */
    @Transactional
    public void saveShippingAddressNotice(Long orderId, AccountKind actorType, Long actorId, String summary) {
        OrderEvent existing = null;
        for (OrderEvent event : eventRepository.findByOrderIdOrderByIdAsc(orderId)) {
            if (event.getEventType() == OrderEventType.SHIPPING_ADDRESS_FILLED) {
                existing = event;
            }
        }
        if (existing == null) {
            record(orderId, OrderEventType.SHIPPING_ADDRESS_FILLED, actorType, actorId, "CUSTOMER",
                    "已提交收货信息", summary, null, null);
            return;
        }
        existing.setContent(summary);
        existing.setActorType(actorType);
        existing.setActorId(actorId);
        existing.setActorRole("CUSTOMER");
        eventRepository.save(existing);
    }

    private String serializeFileIds(List<Long> fileIds) {
        if (fileIds == null || fileIds.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(fileIds);
        } catch (Exception e) {
            log.warn("序列化事件附件ID失败", e);
            return null;
        }
    }
}
