package com.jewelry.system.controller;

import com.jewelry.system.dto.portal.*;
import com.jewelry.system.service.PortalCustomerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/portal/c/account")
@RequiredArgsConstructor
@Tag(name = "C端门户账号", description = "C端客户注册、登录与订单绑定")
public class PortalCustomerAccountController {

    private final PortalCustomerService portalCustomerService;

    @PostMapping("/register")
    @Operation(summary = "注册（可选携带 viewToken 自动绑定订单）")
    public ResponseEntity<PortalCustomerLoginResponse> register(@RequestBody PortalCustomerRegisterRequest req) {
        return ResponseEntity.ok(portalCustomerService.register(req));
    }

    @PostMapping("/login")
    @Operation(summary = "登录")
    public ResponseEntity<PortalCustomerLoginResponse> login(@RequestBody PortalCustomerLoginRequest req) {
        return ResponseEntity.ok(portalCustomerService.login(req));
    }

    @PostMapping("/bind-view-token")
    @Operation(summary = "登录后绑定定制链接中的 view_token")
    public ResponseEntity<Void> bindViewToken(@RequestBody PortalBindViewTokenRequest body) {
        portalCustomerService.bindViewToken(body);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/bind-order")
    @Operation(summary = "凭订单号 + 凭证（view_token 或 B2B access_token）绑定订单")
    public ResponseEntity<Void> bindOrder(@RequestBody PortalBindOrderRequest body) {
        portalCustomerService.bindOrderWithProof(body);
        return ResponseEntity.ok().build();
    }
}
