package com.moje.jewelry3d.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.config.AiServiceConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.File;
import java.util.HashMap;
import java.util.Map;

/**
 * AI推理服务 HTTP 客户端
 * 与 Python FastAPI 服务通过 JSON + 本地文件路径通信
 */
@Slf4j
@Service
public class AiServiceClient {

    private final AiServiceConfig aiServiceConfig;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Autowired
    public AiServiceClient(AiServiceConfig aiServiceConfig) {
        this.aiServiceConfig = aiServiceConfig;
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    private String getBaseUrl() {
        return aiServiceConfig.getBaseUrl();
    }

    /**
     * 建模前背景扣除
     */
    public JsonNode callRemoveBackground(String imagePath, String sessionId) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("image_path", normalizePath(imagePath));
        body.put("session_id", sessionId);
        return postForm("/api/preprocess/remove-background", body);
    }

    /**
     * 切分多视图合一 CAD 图
     */
    public JsonNode callSplitMultiView(String imagePath, String sessionId) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("image_path", normalizePath(imagePath));
        body.put("session_id", sessionId);
        return postForm("/api/preprocess/split-multi-view", body);
    }

    private JsonNode postForm(String path, ObjectNode fields) {
        try {
            String url = getBaseUrl() + path;
            org.springframework.util.LinkedMultiValueMap<String, String> form =
                    new org.springframework.util.LinkedMultiValueMap<>();
            fields.fields().forEachRemaining(entry -> form.add(entry.getKey(), entry.getValue().asText()));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            HttpEntity<org.springframework.util.MultiValueMap<String, String>> entity =
                    new HttpEntity<>(form, headers);

            log.info("调用AI服务 POST {} form={}", url, fields);
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.POST, entity, String.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return objectMapper.readTree(response.getBody());
            }
            throw new BusinessException("AI服务调用失败: HTTP " + response.getStatusCode());
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("调用AI服务异常: {}", path, e);
            throw new BusinessException("AI服务调用异常: " + e.getMessage(), e);
        }
    }

    /**
     * 图片转 3D
     */
    public JsonNode callImageTo3d(
            String taskId,
            String imagePath,
            String settingMeshPath,
            String prompt,
            String resultFormat,
            boolean multiViewEnabled,
            Map<String, String> viewPaths
    ) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("task_id", taskId);
        if (imagePath != null && !imagePath.isBlank()) {
            body.put("image_path", normalizePath(imagePath));
        }
        body.put("multi_view", multiViewEnabled);
        if (multiViewEnabled && viewPaths != null && !viewPaths.isEmpty()) {
            ObjectNode viewsNode = objectMapper.createObjectNode();
            viewPaths.forEach((face, path) -> viewsNode.put(face, normalizePath(path)));
            body.set("views", viewsNode);
        }
        if (settingMeshPath != null && !settingMeshPath.isBlank()) {
            body.put("setting_mesh_path", normalizePath(settingMeshPath));
        }
        if (prompt != null && !prompt.isBlank()) {
            body.put("prompt", prompt);
        }
        body.put("result_format", resultFormat != null ? resultFormat.toLowerCase() : "glb");
        return postJson("/api/generate/image-to-3d", body);
    }

    /**
     * 条件生成（设计图 + 镶嵌底座）
     */
    public JsonNode callConditionGenerate(
            String taskId,
            String designImagePath,
            String settingMeshPath,
            String prompt,
            String resultFormat,
            String inlayType,
            String gemType
    ) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("task_id", taskId);
        body.put("design_image_path", normalizePath(designImagePath));
        body.put("setting_mesh_path", normalizePath(settingMeshPath));
        if (prompt != null && !prompt.isBlank()) {
            body.put("prompt", prompt);
        }
        body.put("result_format", resultFormat != null ? resultFormat.toLowerCase() : "glb");
        if (inlayType != null && !inlayType.isBlank()) {
            body.put("inlay_type", inlayType);
        }
        if (gemType != null && !gemType.isBlank()) {
            body.put("gem_type", gemType);
        }
        body.put("enable_icp_alignment", true);
        body.put("enable_mesh_fusion", true);
        return postJson("/api/generate/condition-generate", body);
    }

    /**
     * 查询 AI 任务状态
     */
    public JsonNode getTaskStatus(String taskId) {
        return doGet("/api/generate/status/" + taskId);
    }

    /**
     * 获取 AI 任务结果
     */
    public JsonNode getTaskResult(String taskId) {
        return doGet("/api/generate/result/" + taskId);
    }

    /**
     * 获取系统信息
     */
    public JsonNode getSystemInfo() {
        return doGet("/api/generate/system-info");
    }

    /**
     * 健康检查
     */
    public boolean isHealthy() {
        try {
            String url = getBaseUrl() + "/health";
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            log.warn("AI服务健康检查失败: {}", e.getMessage());
            return false;
        }
    }

    private JsonNode postJson(String path, ObjectNode body) {
        try {
            String url = getBaseUrl() + path;
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(body), headers);

            log.info("调用AI服务 POST {} body={}", url, body);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return objectMapper.readTree(response.getBody());
            }
            throw new BusinessException("AI服务调用失败: HTTP " + response.getStatusCode());
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("调用AI服务异常: {}", path, e);
            throw new BusinessException("AI服务调用异常: " + e.getMessage(), e);
        }
    }

    private JsonNode doGet(String path) {
        try {
            String url = getBaseUrl() + path;
            log.debug("调用AI服务 GET {}", url);
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return objectMapper.readTree(response.getBody());
            }
            throw new BusinessException("AI服务调用失败: HTTP " + response.getStatusCode());
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("调用AI服务异常: {}", path, e);
            throw new BusinessException("AI服务调用异常: " + e.getMessage(), e);
        }
    }

    private String normalizePath(String path) {
        return new File(path).getAbsolutePath().replace('\\', '/');
    }
}
