package com.jewelry.system.controller;

import com.jewelry.system.dto.customer.CustomerOrderPublicDto;
import com.jewelry.system.service.CustomerOrderViewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/public/customer-order")
@RequiredArgsConstructor
@Tag(name = "C端公开", description = "客户凭令牌查看订单进度（无需登录）")
public class PublicCustomerOrderController {

    private final CustomerOrderViewService customerOrderViewService;

    @GetMapping("/{token}")
    @Operation(summary = "公开订单进度摘要")
    public CustomerOrderPublicDto getSummary(@PathVariable String token) {
        return customerOrderViewService.getPublicSummary(token);
    }
}
