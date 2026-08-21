package com.jewelry.system.controller;

import com.jewelry.system.entity.SysConfig;
import com.jewelry.system.repository.SysConfigRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Google OAuth 登录骨架（预留）。
 * 数据模型 oauth_account 与验证码等基础设施已就绪，本接口仅预留授权入口与回调占位。
 */
@RestController
@RequestMapping("/oauth")
@RequiredArgsConstructor
@Tag(name = "OAuth 登录", description = "第三方登录（预留 Google）")
public class OAuthController {

    private final SysConfigRepository configRepository;

    @GetMapping("/google/authorize")
    @Operation(summary = "Google 授权入口（返回授权参数，实际跳转待接入）")
    public ResponseEntity<Map<String, String>> googleAuthorize() {
        Map<String, String> body = new LinkedHashMap<>();
        body.put("provider", "GOOGLE");
        body.put("clientId", getConfig("oauth.google.clientId"));
        body.put("redirectUri", getConfig("oauth.google.redirectUri"));
        body.put("status", "NOT_IMPLEMENTED");
        return ResponseEntity.ok(body);
    }

    @PostMapping("/google/callback")
    @Operation(summary = "Google 回调（占位，待接入 OAuth 依赖后实现 token 校验与账号绑定）")
    public ResponseEntity<Void> googleCallback(@RequestBody Map<String, String> body) {
        throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "Google 登录待接入，请使用邮箱验证码登录");
    }

    private String getConfig(String key) {
        return configRepository.findByConfigKey(key).map(SysConfig::getConfigValue).orElse("");
    }
}
