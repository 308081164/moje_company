package com.jewelry.system.controller;

import com.jewelry.system.dto.customer.CustomerOrderPublicDto;
import com.jewelry.system.dto.portal.PortalCustomerOrderListItemDto;
import com.jewelry.system.service.PortalCustomerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/portal/c/orders")
@RequiredArgsConstructor
@Tag(name = "C端门户订单", description = "已绑定订单列表与进度摘要")
public class PortalCustomerOrderController {

    private final PortalCustomerService portalCustomerService;

    @GetMapping
    @Operation(summary = "我的订单（已绑定）")
    public ResponseEntity<List<PortalCustomerOrderListItemDto>> list() {
        return ResponseEntity.ok(portalCustomerService.listMyOrders());
    }

    @GetMapping("/{orderId}/summary")
    @Operation(summary = "订单进度摘要（须已绑定）")
    public ResponseEntity<CustomerOrderPublicDto> summary(@PathVariable long orderId) {
        return ResponseEntity.ok(portalCustomerService.getOrderSummary(orderId));
    }
}
