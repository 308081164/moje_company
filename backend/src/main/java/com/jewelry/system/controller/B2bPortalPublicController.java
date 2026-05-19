package com.jewelry.system.controller;

import com.jewelry.system.service.B2bAgentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/public/portal/b2b")
@RequiredArgsConstructor
@Tag(name = "B2B 门户公开", description = "B端门户公开配置")
public class B2bPortalPublicController {

    private final B2bAgentService agentService;

    @GetMapping("/support-wecom")
    @Operation(summary = "客服企业微信二维码配置")
    public ResponseEntity<Map<String, String>> supportWecom() {
        return ResponseEntity.ok(agentService.publicSupportWecom());
    }
}
