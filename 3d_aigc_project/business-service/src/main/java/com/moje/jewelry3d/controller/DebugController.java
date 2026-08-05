package com.moje.jewelry3d.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.common.Result;
import com.moje.jewelry3d.service.DebugPipelineService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/debug")
public class DebugController {

    private final DebugPipelineService debugPipelineService;

    @Autowired
    public DebugController(DebugPipelineService debugPipelineService) {
        this.debugPipelineService = debugPipelineService;
    }

    @PostMapping("/sessions/standalone")
    public Result<JsonNode> createStandaloneSession(
            @RequestParam("raw_mesh") MultipartFile rawMesh,
            @RequestParam("inlay_mesh") MultipartFile inlayMesh,
            @RequestParam(value = "enable_icp", defaultValue = "true") boolean enableIcp,
            @RequestParam(value = "enable_ai_part_split", defaultValue = "false") boolean enableAiPartSplit,
            @RequestParam(value = "output_format", defaultValue = "glb") String outputFormat
    ) {
        JsonNode data = debugPipelineService.createStandaloneSession(
                rawMesh, inlayMesh, enableIcp, enableAiPartSplit, outputFormat
        );
        return Result.success("独立调试会话已创建", data);
    }

    @PostMapping("/steps/{stepId}/run")
    public Result<JsonNode> runStepDirect(
            @PathVariable String stepId,
            @RequestBody com.fasterxml.jackson.databind.node.ObjectNode body
    ) {
        try {
            JsonNode result = debugPipelineService.runStepDirect(stepId, body);
            return Result.success("步骤执行完成", result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("debug step direct failed step={}", stepId, e);
            throw new BusinessException("步骤执行失败: " + e.getMessage(), e);
        }
    }

    @PostMapping("/sessions")
    public Result<JsonNode> createSession(
            @RequestParam("source_task_id") String sourceTaskId,
            @RequestParam(value = "enable_icp", defaultValue = "true") boolean enableIcp,
            @RequestParam(value = "enable_ai_part_split", defaultValue = "false") boolean enableAiPartSplit
    ) {
        JsonNode data = debugPipelineService.createSession(
                sourceTaskId, enableIcp, enableAiPartSplit
        );
        return Result.success("调试会话已创建", data);
    }

    @GetMapping("/sessions/{sessionId}")
    public Result<JsonNode> getSession(@PathVariable String sessionId) {
        return Result.success(debugPipelineService.getSession(sessionId));
    }

    @PostMapping("/sessions/{sessionId}/steps/{stepId}/run")
    public Result<JsonNode> runStep(
            @PathVariable String sessionId,
            @PathVariable String stepId,
            @RequestParam(value = "force", defaultValue = "false") boolean force
    ) {
        try {
            JsonNode result = debugPipelineService.runStep(sessionId, stepId, force);
            return Result.success("步骤执行完成", result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("debug step run failed session={} step={}", sessionId, stepId, e);
            throw new BusinessException("步骤执行失败: " + e.getMessage(), e);
        }
    }

    @PostMapping("/sessions/{sessionId}/steps/{stepId}/confirm")
    public Result<JsonNode> confirmStep(
            @PathVariable String sessionId,
            @PathVariable String stepId
    ) {
        JsonNode session = debugPipelineService.confirmStep(sessionId, stepId);
        return Result.success("已确认，可执行下一步", session);
    }

    @GetMapping("/sessions/{sessionId}/preview/{stepId}")
    public ResponseEntity<Resource> preview(
            @PathVariable String sessionId,
            @PathVariable String stepId
    ) {
        Path path = debugPipelineService.resolvePreviewPath(sessionId, stepId);
        Resource resource = new FileSystemResource(path);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"preview.glb\"")
                .contentType(MediaType.parseMediaType("model/gltf-binary"))
                .body(resource);
    }

    @DeleteMapping("/sessions/{sessionId}")
    public Result<Object> deleteSession(@PathVariable String sessionId) {
        debugPipelineService.deleteSession(sessionId);
        return Result.success("调试会话已删除", null);
    }
}
