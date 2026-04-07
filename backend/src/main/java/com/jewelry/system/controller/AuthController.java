package com.jewelry.system.controller;

import com.jewelry.system.dto.LoginRequest;
import com.jewelry.system.dto.LoginResponse;
import com.jewelry.system.dto.RefreshTokenRequest;
import com.jewelry.system.dto.user.UserResponse;
import com.jewelry.system.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Tag(name = "认证管理", description = "用户登录、登出、令牌刷新等接口")
public class AuthController {
    
    private final AuthService authService;
    
    @PostMapping("/login")
    @Operation(summary = "用户登录", description = "使用用户名和密码登录系统")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest loginRequest) {
        LoginResponse response = authService.login(loginRequest);
        return ResponseEntity.ok(response);
    }
    
    @PostMapping("/logout")
    @Operation(summary = "用户登出", description = "登出系统，使当前令牌失效")
    public ResponseEntity<Void> logout(@RequestHeader(value = "Authorization", required = false) String token) {
        authService.logout(token);
        return ResponseEntity.ok().build();
    }
    
    @PostMapping("/refresh-token")
    @Operation(summary = "刷新令牌", description = "使用刷新令牌获取新的访问令牌（支持 JSON body 或 query）")
    public ResponseEntity<LoginResponse> refreshToken(
            @RequestBody(required = false) RefreshTokenRequest body,
            @RequestParam(required = false) String refreshToken
    ) {
        String rt = null;
        if (body != null && body.getRefreshToken() != null && !body.getRefreshToken().isBlank()) {
            rt = body.getRefreshToken();
        } else if (refreshToken != null && !refreshToken.isBlank()) {
            rt = refreshToken;
        }
        if (rt == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "refreshToken 不能为空");
        }
        LoginResponse response = authService.refreshToken(rt);
        return ResponseEntity.ok(response);
    }
    
    @GetMapping("/current-user")
    @Operation(summary = "获取当前用户信息", description = "获取当前登录用户的详细信息")
    public ResponseEntity<UserResponse> getCurrentUser() {
        return ResponseEntity.ok(authService.getCurrentUser());
    }
}