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
        OrderEvent event = new OrderEvent();
        event.setOrderId(orderId);
        event.setEventType(type);
        event.setActorType(actorType);
        event.setActorId(actorId);
        event.setActorRole(actorRole);
        event.setTitle(title);
        event.setContent(content);
        event.setReason(reason);
        event.setFileIdsJson(serializeFileIds(fileIds));
        event = eventRepository.save(event);
        if (StringUtils.hasText(title)) {
            conversationService.pushEventMessage(orderId, event.getId(), title, actorType, actorId, actorRole);
        }
        return event;
    }

    @Transactional(readOnly = true)
    public List<OrderEventDto> listByOrder(Long orderId) {
        return eventRepository.findByOrderIdOrderByIdAsc(orderId).stream()
                .map(this::toDto)
                .toList();
    }

    /**
     * 客户在卡片上驳回（设计稿或建模稿），记录卡片 + 驳回流程 + 状态回退，并通知建模师/设计师。
     */
    @Transactional
    public OrderEventDto rejectByCustomer(Long orderId, OrderEventType type, AccountKind actorType, Long actorId,
                                          String actorRole, String reason) {
        if (type != OrderEventType.DESIGN_REJECT && type != OrderEventType.MODEL_REJECT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "驳回类型不正确");
        }
        if (!StringUtils.hasText(reason)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "驳回原因不能为空");
        }
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));

        OrderEvent event = record(orderId, type, actorType, actorId, actorRole,
                type.getDescription(), reason, reason, null);

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
