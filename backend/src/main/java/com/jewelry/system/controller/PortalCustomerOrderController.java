package com.jewelry.system.controller;

import com.jewelry.system.dto.customer.CustomerOrderPublicDto;
import com.jewelry.system.dto.portal.CustomerShippingAddressDto;
import com.jewelry.system.dto.portal.CustomerShippingAddressRequest;
import com.jewelry.system.dto.order.OrderEventDto;
import com.jewelry.system.dto.order.OrderShipmentDto;
import com.jewelry.system.dto.portal.CustomerOrderConfirmRequest;
import com.jewelry.system.dto.portal.CustomerOrderRejectRequest;
import com.jewelry.system.dto.portal.CustomerPieceConfirmRequest;
import com.jewelry.system.dto.portal.CustomerPieceRejectRequest;
import com.jewelry.system.dto.portal.CustomerQuotationOptionsRequest;
import com.jewelry.system.dto.portal.PortalCustomerOrderCreateRequest;
import com.jewelry.system.dto.portal.PortalCustomerOrderCreateResponse;
import com.jewelry.system.dto.portal.PortalCustomerOrderListItemDto;
import com.jewelry.system.service.PortalCustomerOrderService;
import com.jewelry.system.service.PortalCustomerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/portal/c/orders")
@RequiredArgsConstructor
@Tag(name = "C端门户订单", description = "已绑定订单列表与进度摘要")
public class PortalCustomerOrderController {

    private final PortalCustomerService portalCustomerService;
    private final PortalCustomerOrderService portalCustomerOrderService;

    @GetMapping
    @Operation(summary = "我的订单（已绑定）")
    public ResponseEntity<List<PortalCustomerOrderListItemDto>> list() {
        return ResponseEntity.ok(portalCustomerService.listMyOrders());
    }

    @PostMapping("/create")
    @Operation(summary = "C端自助下单（来图定制 / 设计师设计）")
    public ResponseEntity<PortalCustomerOrderCreateResponse> create(@RequestBody PortalCustomerOrderCreateRequest req) {
        return ResponseEntity.ok(portalCustomerOrderService.createOrder(req));
    }

    @GetMapping("/{orderId}/summary")
    @Operation(summary = "订单进度摘要（须已绑定）")
    public ResponseEntity<CustomerOrderPublicDto> summary(@PathVariable long orderId) {
        return ResponseEntity.ok(portalCustomerService.getOrderSummary(orderId));
    }

    @GetMapping("/{orderId}/events")
    @Operation(summary = "订单事件卡片列表（须已绑定）")
    public ResponseEntity<List<OrderEventDto>> events(@PathVariable long orderId) {
        return ResponseEntity.ok(portalCustomerService.listOrderEvents(orderId));
    }

    @PostMapping("/{orderId}/reject")
    @Operation(summary = "客户驳回设计稿/建模稿")
    public ResponseEntity<Void> reject(@PathVariable long orderId, @RequestBody CustomerOrderRejectRequest req) {
        portalCustomerService.rejectOrder(orderId, req.getEventType(), req.getReason());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{orderId}/confirm")
    @Operation(summary = "客户确认设计稿/建模稿（事后认可）")
    public ResponseEntity<Void> confirm(@PathVariable long orderId, @RequestBody CustomerOrderConfirmRequest req) {
        portalCustomerService.confirmOrder(orderId, req.getEventType());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{orderId}/pieces/{pieceId}/confirm")
    @Operation(summary = "客户按件确认设计稿/建模稿")
    public ResponseEntity<Void> confirmPiece(@PathVariable long orderId, @PathVariable long pieceId,
                                             @RequestBody CustomerPieceConfirmRequest req) {
        portalCustomerService.confirmPiece(orderId, pieceId, req.getEventType());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{orderId}/pieces/{pieceId}/reject")
    @Operation(summary = "客户按件驳回设计稿/建模稿")
    public ResponseEntity<Void> rejectPiece(@PathVariable long orderId, @PathVariable long pieceId,
                                            @RequestBody CustomerPieceRejectRequest req) {
        portalCustomerService.rejectPiece(orderId, pieceId, req.getEventType(), req.getReason());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{orderId}/confirm-delivery")
    @Operation(summary = "客户确认收货/付尾款（mock）")
    public ResponseEntity<Void> confirmDelivery(@PathVariable long orderId) {
        portalCustomerService.confirmDelivery(orderId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{orderId}/pay-balance")
    @Operation(summary = "客户支付尾款（mock）")
    public ResponseEntity<Void> payBalance(@PathVariable long orderId) {
        portalCustomerService.payBalance(orderId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{orderId}/quotation-options")
    @Operation(summary = "建模确认后选择买断/证书/保密并生成最终报价与尾款")
    public ResponseEntity<Void> submitQuotationOptions(@PathVariable long orderId,
                                                       @RequestBody CustomerQuotationOptionsRequest req) {
        portalCustomerService.submitQuotationOptions(orderId, req);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{orderId}/shipment")
    @Operation(summary = "查询订单物流（客户，须已绑定）")
    public ResponseEntity<OrderShipmentDto> shipment(@PathVariable long orderId) {
        return ResponseEntity.ok(portalCustomerService.getOrderShipment(orderId));
    }

    @GetMapping("/{orderId}/shipping-address")
    @Operation(summary = "查询客户收货信息（须已绑定）")
    public ResponseEntity<CustomerShippingAddressDto> shippingAddress(@PathVariable long orderId) {
        return ResponseEntity.ok(portalCustomerService.getShippingAddress(orderId));
    }

    @PostMapping("/{orderId}/shipping-address")
    @Operation(summary = "客户提交收货信息")
    public ResponseEntity<CustomerShippingAddressDto> submitShippingAddress(
            @PathVariable long orderId,
            @RequestBody CustomerShippingAddressRequest body) {
        return ResponseEntity.ok(portalCustomerService.submitShippingAddress(orderId, body));
    }
}
