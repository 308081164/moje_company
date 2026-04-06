package com.jewelry.system.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
@Tag(name = "健康检查", description = "系统健康状态检查接口")
public class HealthController {
    
    @GetMapping
    @Operation(summary = "健康检查", description = "检查系统是否正常运行")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "UP");
        response.put("timestamp", LocalDateTime.now());
        response.put("service", "珠宝定制管理系统");
        response.put("version", "1.0.0");
        return ResponseEntity.ok(response);
    }
    
    @GetMapping("/info")
    @Operation(summary = "系统信息", description = "获取系统基本信息")
    public ResponseEntity<Map<String, Object>> info() {
        Map<String, Object> info = new HashMap<>();
        info.put("name", "珠宝定制管理系统");
        info.put("version", "1.0.0");
        info.put("description", "珠宝定制工作室企业信息化管理系统");
        info.put("environment", "开发环境");
        info.put("javaVersion", System.getProperty("java.version"));
        info.put("startTime", LocalDateTime.now());
        return ResponseEntity.ok(info);
    }
}