package com.jewelry.system.controller;

import com.jewelry.system.dto.integration.IntegrationSettingsViewDto;
import com.jewelry.system.service.AliyunOssService;
import com.jewelry.system.service.IntegrationSettingsService;
import com.jewelry.system.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/integrations")
@RequiredArgsConstructor
@Tag(name = "销售助手集成", description = "通义千问识图、企业微信进群方式等配置")
public class IntegrationController {

    private final IntegrationSettingsService integrationSettingsService;
    private final AliyunOssService aliyunOssService;

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

    @PostMapping(value = "/b2b-support-wecom-qr", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "上传 B 端门户客服企微二维码")
    public Map<String, String> uploadB2bSupportWecomQr(@RequestPart("file") MultipartFile file) {
        requireAdmin();
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请上传图片");
        }
        try {
            if (!aliyunOssService.isEnabled()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "OSS 未配置");
            }
            String key = "portal/b2b/support-wecom/" + UUID.randomUUID() + ".png";
            String url = aliyunOssService.uploadObject(key, file);
            Map<String, Object> patch = new HashMap<>();
            patch.put("b2bSupportWecomQrUrl", url);
            integrationSettingsService.patch(patch);
            return Map.of("url", url);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "上传失败: " + e.getMessage());
        }
    }

    private static void requireAdmin() {
        if (!"ADMIN".equals(SecurityUtils.currentRoleApi().orElse(null))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可管理集成配置");
        }
    }
}
