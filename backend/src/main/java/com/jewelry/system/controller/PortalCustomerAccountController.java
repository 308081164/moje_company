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

    @PostMapping("/send-verification-code")
    @Operation(summary = "发送邮箱验证码")
    public ResponseEntity<Void> sendVerificationCode(@RequestBody PortalEmailCodeRequest req) {
        portalCustomerService.sendEmailCode(req);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/login-by-code")
    @Operation(summary = "邮箱验证码登录（未注册自动创建账号）")
    public ResponseEntity<PortalCustomerLoginResponse> loginByCode(@RequestBody PortalEmailLoginRequest req) {
        return ResponseEntity.ok(portalCustomerService.loginByEmailCode(req));
    }

    @PostMapping("/register-by-code")
    @Operation(summary = "邮箱验证码注册")
    public ResponseEntity<PortalCustomerLoginResponse> registerByCode(@RequestBody PortalEmailRegisterRequest req) {
        return ResponseEntity.ok(portalCustomerService.registerByEmailCode(req));
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

    @PutMapping("/lang")
    @Operation(summary = "更新语言偏好（用于聊天消息自动翻译）")
    public ResponseEntity<Void> updateLang(@RequestBody PortalCustomerLangRequest req) {
        portalCustomerService.updateLang(req);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/profile")
    @Operation(summary = "更新客户预留基础资料（称呼、联系方式）")
    public ResponseEntity<Void> updateProfile(@RequestBody PortalCustomerProfileRequest req) {
        portalCustomerService.updateProfile(req);
        return ResponseEntity.ok().build();
    }
}
