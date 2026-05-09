package com.jewelry.system.controller;

import com.jewelry.system.dto.integration.IntegrationSettingsViewDto;
import com.jewelry.system.service.IntegrationSettingsService;
import com.jewelry.system.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/integrations")
@RequiredArgsConstructor
@Tag(name = "销售助手集成", description = "通义千问识图、企业微信进群方式等配置")
public class IntegrationController {

    private final IntegrationSettingsService integrationSettingsService;

    @GetMapping("/settings")
    @Operation(summary = "获取集成配置（管理员）")
    public IntegrationSettingsViewDto getSettings() {
        requireAdmin();
        return integrationSettingsService.getView();
    }

    @PutMapping("/settings")
    @Operation(summary = "更新集成配置（管理员，密钥类字段传空则不改）")
    public IntegrationSettingsViewDto putSettings(@RequestBody Map<String, Object> body) {
        requireAdmin();
        return integrationSettingsService.patch(body);
    }

    private static void requireAdmin() {
        if (!"ADMIN".equals(SecurityUtils.currentRoleApi().orElse(null))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可管理集成配置");
        }
    }
}
