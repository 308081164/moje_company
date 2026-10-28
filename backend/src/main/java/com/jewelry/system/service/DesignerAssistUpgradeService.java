package com.jewelry.system.service;

import com.jewelry.system.dto.portal.DesignerAssistPayResponse;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.OrderPiece;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.enums.ServiceType;
import com.jewelry.system.repository.OrderCustomerBriefRepository;
import com.jewelry.system.repository.OrderPieceRepository;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.PortalCustomerOrderBindingRepository;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DesignerAssistUpgradeService {

    /** 来图定制额外请设计师协助。客户信息越完整，价格越低：未填问卷 $100，已填问卷 $80，已确认建模 $60。 */
    public static final BigDecimal DESIGNER_ASSIST_PRICE_FULL = new BigDecimal("100.00");
    public static final BigDecimal DESIGNER_ASSIST_PRICE_BRIEF = new BigDecimal("80.00");
    public static final BigDecimal DESIGNER_ASSIST_PRICE_MODEL = new BigDecimal("60.00");

    private final OrderRepository orderRepository;
    private final OrderPieceRepository orderPieceRepository;
    private final OrderCustomerBriefRepository orderCustomerBriefRepository;
    private final PortalCustomerOrderBindingRepository bindingRepository;
    private final AutoAssignmentService autoAssignmentService;
    private final OrderEventService orderEventService;
    private final ConversationService conversationService;

    @Transactional(readOnly = true)
    public boolean canUpgrade(long orderId) {
        Order order = orderRepository.findById(orderId).orElse(null);
        return order != null
                && order.getServiceType() == ServiceType.CUSTOM_IMAGE
                && !Boolean.TRUE.equals(order.getDesignerAssistPaid());
    }

    @Transactional
    public BigDecimal assistPrice(long orderId, Order order) {
        if (order.getServiceType() != ServiceType.CUSTOM_IMAGE) {
            return DESIGNER_ASSIST_PRICE_FULL;
        }
        boolean modelConfirmed = orderPieceRepository.findByOrderIdOrderBySeqAsc(orderId).stream()
                .allMatch(p -> Boolean.TRUE.equals(p.getModelConfirmed()));
        if (modelConfirmed) {
            return DESIGNER_ASSIST_PRICE_MODEL;
        }
        boolean briefSubmitted = orderCustomerBriefRepository.findByOrderId(orderId)
                .map(b -> b.getSubmittedAt() != null)
                .orElse(false);
        return briefSubmitted ? DESIGNER_ASSIST_PRICE_BRIEF : DESIGNER_ASSIST_PRICE_FULL;
    }

    @Transactional
    public DesignerAssistPayResponse upgrade(long orderId) {
        Long accountId = SecurityUtils.currentPortalCustomerId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录"));
        bindingRepository.findByPortalCustomerIdAndOrderId(accountId, orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "无权操作该订单或未绑定"));
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
        if (order.getServiceType() != ServiceType.CUSTOM_IMAGE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "该订单不是来图定制，无需支付设计师协助费用");
        }
        if (Boolean.TRUE.equals(order.getDesignerAssistPaid())) {
            return DesignerAssistPayResponse.builder()
                    .orderId(orderId)
                    .serviceType(order.getServiceType().name())
                    .designerAssistPaid(true)
                    .message("该订单已支付设计师协助费用")
                    .assistPrice(assistPrice(orderId, order).stripTrailingZeros().toPlainString())
                    .build();
        }
        BigDecimal price = assistPrice(orderId, order);
        List<OrderPiece> pieces = orderPieceRepository.findByOrderIdOrderBySeqAsc(orderId);
        for (OrderPiece piece : pieces) {
            piece.setDesignConfirmed(false);
            orderPieceRepository.save(piece);
        }
        order.setServiceType(ServiceType.DESIGNER_DESIGN);
        order.setDesignerAssistPaid(true);
        order.setDesignerAssistPaidAt(LocalDateTime.now());
        order.setStatus(OrderStatus.PENDING_DESIGN);
        orderRepository.save(order);

        autoAssignmentService.assignDesignerForAssistUpgrade(orderId);
        conversationService.ensureConversationByOrder(orderId);

        String text = "客户已支付设计师协助费用 $" + price.stripTrailingZeros().toPlainString()
                + "（模拟），订单转为设计师设计。已填写的信息会保留，请设计师先核对后再继续。";
        orderEventService.record(orderId, com.jewelry.system.enums.OrderEventType.STATUS_CHANGE,
                com.jewelry.system.security.AccountKind.C_PORTAL_CUSTOMER, accountId, "CUSTOMER",
                "已支付设计师协助费用", text, null, null);

        return DesignerAssistPayResponse.builder()
                .orderId(orderId)
                .serviceType(ServiceType.DESIGNER_DESIGN.name())
                .designerAssistPaid(true)
                .message("已转为设计师设计，已填写的信息会保留。请核对后等待设计师联系。")
                .assistPrice(price.stripTrailingZeros().toPlainString())
                .build();
    }
}
