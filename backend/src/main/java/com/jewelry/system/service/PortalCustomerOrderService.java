package com.jewelry.system.service;

import com.jewelry.system.dto.conversation.ConversationDto;
import com.jewelry.system.dto.portal.PortalCustomerOrderCreateRequest;
import com.jewelry.system.dto.portal.PortalCustomerOrderCreateResponse;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.OrderPiece;
import com.jewelry.system.entity.PortalCustomerOrderBinding;
import com.jewelry.system.enums.OrderEventType;
import com.jewelry.system.enums.OrderSource;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.enums.ServiceType;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.PortalCustomerAccountRepository;
import com.jewelry.system.repository.PortalCustomerOrderBindingRepository;
import com.jewelry.system.security.AccountKind;
import com.jewelry.system.util.SecurityUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * C 端门户客户自助下单：来图定制（跳过设计师直接派建模师）与设计师设计（拉设计师入群）。
 */
@Service
@RequiredArgsConstructor
public class PortalCustomerOrderService {

    private final OrderRepository orderRepository;
    private final PortalCustomerAccountRepository accountRepository;
    private final PortalCustomerOrderBindingRepository bindingRepository;
    private final OrderCommandService orderCommandService;
    private final AutoAssignmentService autoAssignmentService;
    private final ConversationService conversationService;
    private final OrderEventService orderEventService;
    private final ReferralService referralService;
    private final ObjectMapper objectMapper;
    private final OrderPieceService orderPieceService;

    @Transactional
    public PortalCustomerOrderCreateResponse createOrder(PortalCustomerOrderCreateRequest req) {
        Long accountId = SecurityUtils.currentPortalCustomerId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录"));

        ServiceType type;
        try {
            type = ServiceType.fromString(req.getServiceType());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        if (!StringUtils.hasText(req.getBasicRequirements())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "基础需求不能为空");
        }

        var account = accountRepository.findById(accountId).orElse(null);
        String accountEmail = account != null ? account.getEmail() : null;
        String accountName = account != null ? account.getDisplayName() : null;

        Order order = new Order();
        order.setSource(OrderSource.C2C);
        order.setServiceType(type);
        order.setIsB2b(false);
        order.setCustomerName(StringUtils.hasText(req.getCustomerName())
                ? req.getCustomerName()
                : (StringUtils.hasText(accountName) ? accountName : accountEmail));
        order.setCustomerEmail(accountEmail);
        order.setBasicRequirements(req.getBasicRequirements());
        order.setStyleInfo(req.getStyleInfo());
        order.setMaterialInfo(req.getMaterialInfo());
        order.setDeposit(req.getDepositAmount() != null ? req.getDepositAmount() : BigDecimal.ZERO);
        order.setOrderTime(LocalDateTime.now());
        order.setOrderNumber(orderCommandService.generateOrderNumber());
        order.setStatus(type == ServiceType.CUSTOM_IMAGE ? OrderStatus.PENDING_MODEL : OrderStatus.PENDING_DESIGN);
        orderRepository.save(order);
        OrderPiece defaultPiece = orderPieceService.ensureDefaultPiece(order.getId());
        if (type == ServiceType.CUSTOM_IMAGE) {
            orderPieceService.markDesignConfirmed(order.getId(), defaultPiece.getId());
        }

        PortalCustomerOrderBinding binding = new PortalCustomerOrderBinding();
        binding.setPortalCustomerId(accountId);
        binding.setOrderId(order.getId());
        binding.setBindSource("SELF_CREATE");
        bindingRepository.save(binding);

        // 个人推广码（选填）：以定金为佣金基数，统一 5%
        referralService.bindOnOrder(accountId, req.getReferralCode(), order, order.getDeposit());

        if (type == ServiceType.CUSTOM_IMAGE) {
            autoAssignmentService.autoAssignC2cImageOrder(order.getId());
        } else {
            autoAssignmentService.autoAssignAll(order.getId());
        }

        // 参考图写入默认单件（与设计师稿分离）
        if (req.getReferenceImages() != null && !req.getReferenceImages().isEmpty()) {
            orderPieceService.setReferenceImages(defaultPiece, req.getReferenceImages());
        }

        ConversationDto conversation = conversationService.ensureConversationByOrder(order.getId());

        orderEventService.record(order.getId(), OrderEventType.STATUS_CHANGE,
                AccountKind.C_PORTAL_CUSTOMER, accountId, "CUSTOMER",
                type.getDescription() + "订单已创建", req.getBasicRequirements(), null, null);

        return PortalCustomerOrderCreateResponse.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .conversationId(conversation.getId())
                .serviceType(type.name())
                .build();
    }

    private String toJson(Object o) {
        try {
            return objectMapper.writeValueAsString(o);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "参考图序列化失败");
        }
    }
}
