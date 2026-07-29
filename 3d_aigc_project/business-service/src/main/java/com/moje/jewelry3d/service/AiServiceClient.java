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

    /**
     * 宝石占位色：将反光宝石区填平坦色
     */
    public JsonNode callGemFlatten(
            String imagePath,
            String sessionId,
            String gemPreset,
            String customColor,
            double sensitivity,
            boolean preserveEdges
    ) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("image_path", normalizePath(imagePath));
        body.put("session_id", sessionId);
        body.put("gem_preset", gemPreset != null && !gemPreset.isBlank() ? gemPreset : "ruby");
        if (customColor != null && !customColor.isBlank()) {
            body.put("custom_color", customColor);
        }
        body.put("sensitivity", sensitivity);
        body.put("preserve_edges", preserveEdges);
        return postForm("/api/preprocess/gem-flatten", body);
    }

    /**
     * SAM 点选宝石蒙版预览
     */
    public JsonNode callGemSegmentSam(String imagePath, String sessionId, String pointsJson) {
        return callGemSegmentSam(imagePath, sessionId, pointsJson, 8);
    }

    /**
     * SAM 点选宝石蒙版（含 mask 文件路径，供云端重绘）
     */
    public JsonNode callGemSegmentSam(
            String imagePath,
            String sessionId,
            String pointsJson,
            int maskDilatePx
    ) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("image_path", normalizePath(imagePath));
        body.put("session_id", sessionId);
        body.put("points_json", pointsJson);
        body.put("mask_dilate_px", maskDilatePx);
        return postForm("/api/preprocess/gem-segment-sam", body);
    }

    /**
     * HSV 自动检测宝石蒙版（无需 SAM 点选）
     */
    public JsonNode callGemSegmentAuto(
            String imagePath,
            String sessionId,
            double sensitivity,
            int maskDilatePx
    ) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("image_path", normalizePath(imagePath));
        body.put("session_id", sessionId);
        body.put("sensitivity", sensitivity);
        body.put("mask_dilate_px", maskDilatePx);
        return postForm("/api/preprocess/gem-segment-auto", body);
    }

    /**
     * SAM 点选宝石并填占位色
     */
    public JsonNode callGemFlattenSam(
            String imagePath,
            String sessionId,
            String pointsJson,
            String gemPreset,
            String customColor,
            boolean preserveEdges
    ) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("image_path", normalizePath(imagePath));
        body.put("session_id", sessionId);
        body.put("points_json", pointsJson);
        body.put("gem_preset", gemPreset != null && !gemPreset.isBlank() ? gemPreset : "ruby");
        if (customColor != null && !customColor.isBlank()) {
            body.put("custom_color", customColor);
        }
        body.put("preserve_edges", preserveEdges);
        return postForm("/api/preprocess/gem-flatten-sam", body);
    }

    /**
     * SAM 点选宝石去反光 AI 重绘
     */
    public JsonNode callGemRepaintSam(
            String imagePath,
            String sessionId,
            String pointsJson,
            String prompt,
            double strength,
            int maskDilatePx,
            boolean preserveEdges,
            Integer seed
    ) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("image_path", normalizePath(imagePath));
        body.put("session_id", sessionId);
        body.put("points_json", pointsJson);
        if (prompt != null && !prompt.isBlank()) {
            body.put("prompt", prompt);
        }
        body.put("strength", strength);
        body.put("mask_dilate_px", maskDilatePx);
        body.put("preserve_edges", preserveEdges);
        if (seed != null) {
            body.put("seed", seed);
        }
        return postForm("/api/preprocess/gem-repaint", body);
    }

    /**
     * 网格格式转换（OBJ/GLB/STL 互转）
     */
    public JsonNode callMeshConvert(
            String inputPath,
            String outputPath,
            String outputFormat,
            String sessionId
    ) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("input_path", normalizePath(inputPath));
        body.put("output_path", normalizePath(outputPath));
        body.put("output_format", outputFormat != null ? outputFormat.toLowerCase() : "glb");
        body.put("session_id", sessionId);
        return postForm("/api/mesh/convert", body);
    }

    public JsonNode callMeshSanitize(String meshPath, String outputPath, boolean selectPrimary) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("mesh_path", normalizePath(meshPath));
        if (outputPath != null && !outputPath.isBlank()) {
            body.put("output_path", normalizePath(outputPath));
        }
        body.put("select_primary", selectPrimary);
        return postForm("/api/mesh/edit/sanitize", body);
    }

    public JsonNode callMeshSplitComponents(String meshPath) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("mesh_path", normalizePath(meshPath));
        return postForm("/api/mesh/edit/split-components", body);
    }

    public JsonNode callMeshMergeComponents(
            String meshPath,
            String keepIndicesJson,
            String outputPath,
            String outputFormat
    ) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("mesh_path", normalizePath(meshPath));
        body.put("keep_indices_json", keepIndicesJson);
        if (outputPath != null && !outputPath.isBlank()) {
            body.put("output_path", normalizePath(outputPath));
        }
        body.put("output_format", outputFormat != null ? outputFormat.toLowerCase() : "glb");
        return postForm("/api/mesh/edit/merge-components", body);
    }

    public JsonNode callMeshClipPlane(
            String meshPath,
            String planeOriginJson,
            String planeNormalJson,
            boolean keepPositive,
            String outputPath,
            String outputFormat
    ) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("mesh_path", normalizePath(meshPath));
        body.put("plane_origin_json", planeOriginJson);
        body.put("plane_normal_json", planeNormalJson);
        body.put("keep_positive", keepPositive);
        if (outputPath != null && !outputPath.isBlank()) {
            body.put("output_path", normalizePath(outputPath));
        }
        body.put("output_format", outputFormat != null ? outputFormat.toLowerCase() : "glb");
        return postForm("/api/mesh/edit/clip-plane", body);
    }

    public JsonNode callMeshBooleanDifference(
            String meshPath,
            String subtractMeshPath,
            String outputPath,
            String outputFormat
    ) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("mesh_path", normalizePath(meshPath));
        body.put("subtract_mesh_path", normalizePath(subtractMeshPath));
        if (outputPath != null && !outputPath.isBlank()) {
            body.put("output_path", normalizePath(outputPath));
        }
        body.put("output_format", outputFormat != null ? outputFormat.toLowerCase() : "glb");
        return postForm("/api/mesh/edit/boolean-difference", body);
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
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            String detail = extractFastApiDetail(e.getResponseBodyAsString());
            int code = e.getStatusCode().value();
            throw new BusinessException(code >= 400 && code < 500 ? code : 500, detail);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("调用AI服务异常: {}", path, e);
            throw new BusinessException("AI服务调用异常: " + e.getMessage(), e);
        }
    }

    private String extractFastApiDetail(String body) {
        if (body == null || body.isBlank()) {
            return "AI服务请求失败";
        }
        try {
            JsonNode node = objectMapper.readTree(body);
            if (node.has("detail")) {
                return node.path("detail").asText("AI服务请求失败");
            }
        } catch (Exception ignored) {
            // fall through
        }
        return body.length() > 200 ? body.substring(0, 200) : body;
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
            Map<String, String> viewPaths,
            String generationMode
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
            // 分色双网格：前端「分色预览」依赖 COLOR_0 / inlay_structure+ai_generated
            body.put("fusion_method", "colored_merge");
            body.put("enable_mesh_fusion", true);
        }
        if (prompt != null && !prompt.isBlank()) {
            body.put("prompt", prompt);
        }
        body.put("result_format", resultFormat != null ? resultFormat.toLowerCase() : "glb");
        body.put("generation_mode", normalizeGenerationMode(generationMode));
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
            String gemType,
            String generationMode
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
        body.put("fusion_method", "colored_merge");
        body.put("generation_mode", normalizeGenerationMode(generationMode));
        return postJson("/api/generate/condition-generate", body);
    }

    private static String normalizeGenerationMode(String generationMode) {
        if (generationMode == null || generationMode.isBlank()) {
            return "quality";
        }
        String mode = generationMode.trim().toLowerCase();
        if ("fast".equals(mode) || "speed".equals(mode) || "急速".equals(mode) || "快速".equals(mode)) {
            return "fast";
        }
        return "quality";
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
