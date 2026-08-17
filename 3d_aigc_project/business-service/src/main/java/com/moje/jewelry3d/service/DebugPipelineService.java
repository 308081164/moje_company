package com.moje.jewelry3d.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.config.AiServiceConfig;
import com.moje.jewelry3d.config.FileStorageConfig;
import com.moje.jewelry3d.inlay.service.LegacyPathResolver;
import com.moje.jewelry3d.entity.GenerateTaskEntity;
import com.moje.jewelry3d.repository.GenerateTaskRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Slf4j
@Service
public class DebugPipelineService {

    private static final String INLAY_BACKFILL_MARKER = "colored_merge";

    private final AiServiceClient aiServiceClient;
    private final AiServiceConfig aiServiceConfig;
    private final FileStorageConfig fileStorageConfig;
    private final GenerateTaskRepository taskRepository;
    private final LegacyPathResolver legacyPathResolver;
    private final ObjectMapper objectMapper;

    @Autowired
    public DebugPipelineService(
            AiServiceClient aiServiceClient,
            AiServiceConfig aiServiceConfig,
            FileStorageConfig fileStorageConfig,
            GenerateTaskRepository taskRepository,
            LegacyPathResolver legacyPathResolver,
            ObjectMapper objectMapper
    ) {
        this.aiServiceClient = aiServiceClient;
        this.aiServiceConfig = aiServiceConfig;
        this.fileStorageConfig = fileStorageConfig;
        this.taskRepository = taskRepository;
        this.legacyPathResolver = legacyPathResolver;
        this.objectMapper = objectMapper;
    }

    public JsonNode createStandaloneSession(
            MultipartFile rawMesh,
            MultipartFile inlayMesh,
            boolean enableIcp,
            boolean enableAiPartSplit,
            String outputFormat
    ) {
        if (rawMesh == null || rawMesh.isEmpty()) {
            throw new BusinessException(400, "请上传 raw_mesh");
        }
        if (inlayMesh == null || inlayMesh.isEmpty()) {
            throw new BusinessException(400, "请上传 inlay_mesh");
        }
        try {
            ByteArrayResource rawResource = new ByteArrayResource(rawMesh.getBytes()) {
                @Override
                public String getFilename() {
                    return rawMesh.getOriginalFilename() != null
                            ? rawMesh.getOriginalFilename()
                            : "raw_mesh.obj";
                }
            };
            ByteArrayResource inlayResource = new ByteArrayResource(inlayMesh.getBytes()) {
                @Override
                public String getFilename() {
                    return inlayMesh.getOriginalFilename() != null
                            ? inlayMesh.getOriginalFilename()
                            : "inlay.glb";
                }
            };
            JsonNode created = aiServiceClient.createStandaloneDebugSession(
                    rawResource,
                    inlayResource,
                    enableIcp,
                    enableAiPartSplit,
                    outputFormat
            );
            ObjectNode wrapper = objectMapper.createObjectNode();
            wrapper.put("session_id", created.path("session_id").asText());
            wrapper.put("source_task_id", created.path("source_task_id").asText(""));
            wrapper.set("session", created);
            return wrapper;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("创建独立调试会话失败", e);
            throw new BusinessException("创建独立调试会话失败: " + e.getMessage(), e);
        }
    }

    public JsonNode runStepDirect(String stepId, ObjectNode body) {
        String rawPath = body.path("raw_mesh_path").asText(null);
        String inlayPath = body.path("inlay_mesh_path").asText(null);
        if (rawPath == null || rawPath.isBlank()) {
            throw new BusinessException(400, "缺少 raw_mesh_path");
        }
        if (inlayPath == null || inlayPath.isBlank()) {
            throw new BusinessException(400, "缺少 inlay_mesh_path");
        }
        JsonNode context = body.get("context");
        boolean force = body.path("force").asBoolean(false);
        return aiServiceClient.runDebugStepDirect(stepId, rawPath, inlayPath, context, force);
    }

    public JsonNode createSession(String sourceTaskId, boolean enableIcp) {
        return createSession(sourceTaskId, enableIcp, false);
    }

    public JsonNode createSession(
            String sourceTaskId,
            boolean enableIcp,
            boolean enableAiPartSplit
    ) {
        GenerateTaskEntity task = taskRepository.findById(sourceTaskId)
                .orElseThrow(() -> new BusinessException(404, "任务不存在: " + sourceTaskId));
        if (!"completed".equals(task.getStatus())) {
            throw new BusinessException(400, "仅已完成任务可进入调试模式，请先完成一次普通生成");
        }
        String inlayRef = task.getInlayStructureFilename();
        if (inlayRef == null || inlayRef.isBlank() || INLAY_BACKFILL_MARKER.equals(inlayRef)) {
            throw new BusinessException(400, "该任务未使用镶嵌结构，无法调试对齐流水线");
        }

        Path rawMesh = resolveRawMeshPath(sourceTaskId);
        if (rawMesh == null || !Files.isRegularFile(rawMesh)) {
            throw new BusinessException(
                    400,
                    "未找到 raw_mesh.obj，请先完成一次带镶嵌的普通生成"
            );
        }

        String inlayPath = resolveInlayMeshPath(inlayRef);
        Path inlayFile = Path.of(inlayPath);
        if (!Files.isRegularFile(inlayFile)) {
            throw new BusinessException(404, "镶嵌底座文件不存在: " + inlayRef);
        }

        String sessionId = UUID.randomUUID().toString();
        Path debugInputDir = aiServiceConfig.getOutputPath()
                .resolve("debug")
                .resolve(sessionId)
                .resolve("inputs");
        try {
            Files.createDirectories(debugInputDir);
            Path localRaw = debugInputDir.resolve("raw_mesh.obj");
            String inlayExt = extensionOf(inlayFile.getFileName().toString());
            Path localInlay = debugInputDir.resolve("inlay" + inlayExt);
            Files.copy(rawMesh, localRaw, StandardCopyOption.REPLACE_EXISTING);
            Files.copy(inlayFile, localInlay, StandardCopyOption.REPLACE_EXISTING);

            JsonNode created = aiServiceClient.createDebugSession(
                    sourceTaskId,
                    localRaw.toString(),
                    localInlay.toString(),
                    sessionId,
                    enableIcp,
                    enableAiPartSplit
            );
            ObjectNode wrapper = objectMapper.createObjectNode();
            wrapper.put("session_id", created.path("session_id").asText(sessionId));
            wrapper.put("source_task_id", sourceTaskId);
            wrapper.set("session", created);
            return wrapper;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("创建调试会话失败 taskId={}", sourceTaskId, e);
            throw new BusinessException("创建调试会话失败: " + e.getMessage(), e);
        }
    }

    public JsonNode getSession(String sessionId) {
        return aiServiceClient.getDebugSession(sessionId);
    }

    public JsonNode runStep(String sessionId, String stepId, boolean force) {
        return aiServiceClient.runDebugStep(sessionId, stepId, force);
    }

    public JsonNode confirmStep(String sessionId, String stepId) {
        return aiServiceClient.confirmDebugStep(sessionId, stepId);
    }

    public void deleteSession(String sessionId) {
        aiServiceClient.deleteDebugSession(sessionId);
    }

    public Path resolvePreviewPath(String sessionId, String stepId) {
        Path path = aiServiceClient.resolveDebugPreviewPath(sessionId, stepId);
        if (path != null && Files.isRegularFile(path)) {
            return path;
        }
        throw new BusinessException(404, "预览文件尚未就绪，请先执行该步骤");
    }

    private Path resolveRawMeshPath(String taskId) {
        Path aiRaw = aiServiceConfig.getOutputPath().resolve(taskId).resolve("raw_mesh.obj");
        if (Files.isRegularFile(aiRaw)) {
            return aiRaw;
        }
        Path bizRaw = fileStorageConfig.getOutputPath().resolve(taskId).resolve("raw_mesh.obj");
        if (Files.isRegularFile(bizRaw)) {
            return bizRaw;
        }
        return null;
    }

    private String resolveInlayMeshPath(String filename) {
        String resolved = legacyPathResolver.resolveMeshPath(filename);
        if (resolved != null) {
            return resolved;
        }
        throw new BusinessException(404, "镶嵌结构不存在: " + filename);
    }

    private static String extensionOf(String filename) {
        if (filename == null || filename.isBlank()) {
            return ".glb";
        }
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) {
            return ".glb";
        }
        String ext = filename.substring(dot).toLowerCase();
        return switch (ext) {
            case ".obj", ".glb", ".stl" -> ext;
            default -> ".glb";
        };
    }
}
