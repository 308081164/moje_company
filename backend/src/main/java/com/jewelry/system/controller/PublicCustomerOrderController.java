package com.jewelry.system.controller;

import com.jewelry.system.dto.customer.CustomerOrderRegistrationHintDto;
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
@Tag(name = "C端公开", description = "定制链接预填信息（不含完整进度）")
public class PublicCustomerOrderController {

    private final CustomerOrderViewService customerOrderViewService;

    @GetMapping("/{token}/hint")
    @Operation(summary = "凭 view_token 获取注册/登录预填信息")
    public CustomerOrderRegistrationHintDto registrationHint(@PathVariable String token) {
        return customerOrderViewService.getRegistrationHint(token);
    }
}
