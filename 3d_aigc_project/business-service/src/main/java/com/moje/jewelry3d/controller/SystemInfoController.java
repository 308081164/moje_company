package com.moje.jewelry3d.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.moje.jewelry3d.common.Result;
import com.moje.jewelry3d.model.dto.SystemInfo;
import com.moje.jewelry3d.service.AiServiceClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 系统信息控制器
 * 提供系统状态查询和健康检查接口
 */
@Slf4j
@RestController
@RequestMapping("/api/system")
public class SystemInfoController {

    private final AiServiceClient aiServiceClient;

    @Autowired
    public SystemInfoController(AiServiceClient aiServiceClient) {
        this.aiServiceClient = aiServiceClient;
    }

    /**
     * 获取系统信息
     * 包含业务服务状态和AI服务状态（GPU信息等）
     *
     * @return 系统信息
     */
    @GetMapping("/info")
    public Result<SystemInfo> getSystemInfo() {
        SystemInfo info = new SystemInfo();
        info.setServiceName("jewelry3d-business-service");
        info.setVersion("1.0.0");
        info.setStatus("running");

        // 检查AI服务可用性并获取信息
        boolean aiAvailable = aiServiceClient.isHealthy();
        info.setAiServiceAvailable(aiAvailable);

        if (aiAvailable) {
            try {
                JsonNode aiInfo = aiServiceClient.getSystemInfo();
                if (aiInfo != null) {
                    List<Map<String, Object>> gpuList = new ArrayList<>();
                    Map<String, Object> gpuMap = new HashMap<>();
                    if (aiInfo.has("gpu_name")) {
                        gpuMap.put("name", aiInfo.get("gpu_name").asText());
                    }
                    if (aiInfo.has("vram_gb")) {
                        gpuMap.put("vram_gb", aiInfo.get("vram_gb").asText());
                    }
                    if (aiInfo.has("recommended_model")) {
                        gpuMap.put("recommended_model", aiInfo.get("recommended_model").asText());
                    }
                    gpuList.add(gpuMap);
                    info.setGpuInfo(gpuList);

                    if (aiInfo.has("memory_usage_mb")) {
                        info.setUsedMemoryMb(aiInfo.get("memory_usage_mb").asLong());
                    }
                }
            } catch (Exception e) {
                log.warn("获取AI服务系统信息失败: {}", e.getMessage());
            }
        }

        // JVM内存信息
        Runtime runtime = Runtime.getRuntime();
        Map<String, Object> extra = new HashMap<>();
        extra.put("jvm_max_memory_mb", runtime.maxMemory() / (1024 * 1024));
        extra.put("jvm_total_memory_mb", runtime.totalMemory() / (1024 * 1024));
        extra.put("jvm_free_memory_mb", runtime.freeMemory() / (1024 * 1024));
        extra.put("jvm_processors", runtime.availableProcessors());
        info.setExtra(extra);

        return Result.success(info);
    }

    /**
     * 健康检查接口
     * 用于负载均衡和监控探活
     *
     * @return 健康状态
     */
    @GetMapping("/health")
    public Result<Map<String, Object>> health() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("service", "jewelry3d-business-service");
        health.put("ai_service", aiServiceClient.isHealthy() ? "UP" : "DOWN");
        health.put("timestamp", System.currentTimeMillis());
        return Result.success(health);
    }
}
