package com.moje.jewelry3d.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.moje.jewelry3d.common.Result;
import com.moje.jewelry3d.service.MeshEditService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 网格编辑 API（business 代理 ai-service，供镶嵌库裁剪）
 */
@Slf4j
@RestController
@RequestMapping("/api/mesh/edit")
public class MeshEditController {

    private final MeshEditService meshEditService;

    @Autowired
    public MeshEditController(MeshEditService meshEditService) {
        this.meshEditService = meshEditService;
    }

    @PostMapping("/inlay/{id}/sanitize")
    public Result<Map<String, Object>> sanitize(
            @PathVariable String id,
            @RequestParam(name = "select_primary", defaultValue = "true") boolean selectPrimary
    ) {
        return Result.success("网格清洗完成", meshEditService.sanitizeInlayMesh(id, selectPrimary));
    }

    @PostMapping("/inlay/{id}/split-components")
    public Result<JsonNode> splitComponents(@PathVariable String id) {
        return Result.success(meshEditService.splitComponents(id));
    }

    @PostMapping("/inlay/{id}/merge-components")
    public Result<Map<String, Object>> mergeComponents(
            @PathVariable String id,
            @RequestParam(name = "keep_indices") String keepIndices,
            @RequestParam(name = "output_format", defaultValue = "glb") String outputFormat
    ) {
        List<Integer> indices = parseIndices(keepIndices);
        return Result.success(meshEditService.mergeComponents(id, indices, outputFormat));
    }

    @PostMapping("/inlay/{id}/crop-and-save")
    public Result<Map<String, Object>> cropAndSave(
            @PathVariable String id,
            @RequestParam(name = "keep_indices") String keepIndices,
            @RequestParam(name = "output_format", defaultValue = "glb") String outputFormat
    ) {
        List<Integer> indices = parseIndices(keepIndices);
        return Result.success("裁剪已保存", meshEditService.cropAndSave(id, indices, outputFormat));
    }

    @PostMapping("/inlay/{id}/clip-plane")
    public Result<Map<String, Object>> clipPlane(
            @PathVariable String id,
            @RequestParam(name = "origin") String origin,
            @RequestParam(name = "normal") String normal,
            @RequestParam(name = "keep_positive", defaultValue = "true") boolean keepPositive,
            @RequestParam(name = "output_format", defaultValue = "glb") String outputFormat,
            @RequestParam(name = "save", defaultValue = "false") boolean save
    ) {
        double[] originArr = parseVec3(origin, "origin");
        double[] normalArr = parseVec3(normal, "normal");
        return Result.success(
                save ? "剖切已保存" : "剖切预览完成",
                meshEditService.clipPlane(id, originArr, normalArr, keepPositive, outputFormat, save)
        );
    }

    @PostMapping("/inlay/{id}/boolean-difference")
    public Result<Map<String, Object>> booleanDifference(
            @PathVariable String id,
            @RequestParam(name = "subtract_mesh_path") String subtractMeshPath,
            @RequestParam(name = "output_format", defaultValue = "glb") String outputFormat,
            @RequestParam(name = "save", defaultValue = "false") boolean save
    ) {
        return Result.success(
                save ? "布尔挖除已保存" : "布尔挖除预览完成",
                meshEditService.booleanDifference(id, subtractMeshPath, outputFormat, save)
        );
    }

    private static List<Integer> parseIndices(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new com.moje.jewelry3d.common.BusinessException("keep_indices 不能为空");
        }
        String trimmed = raw.trim();
        if (trimmed.startsWith("[")) {
            trimmed = trimmed.substring(1, trimmed.length() - 1);
        }
        return Arrays.stream(trimmed.split("[,，\\s]+"))
                .filter(s -> !s.isBlank())
                .map(Integer::parseInt)
                .collect(Collectors.toList());
    }

    private static double[] parseVec3(String raw, String label) {
        if (raw == null || raw.isBlank()) {
            throw new com.moje.jewelry3d.common.BusinessException(label + " 不能为空");
        }
        String trimmed = raw.trim();
        if (trimmed.startsWith("[")) {
            trimmed = trimmed.substring(1, trimmed.length() - 1);
        }
        String[] parts = trimmed.split("[,，\\s]+");
        if (parts.length != 3) {
            throw new com.moje.jewelry3d.common.BusinessException(label + " 必须为 3 个数值");
        }
        return new double[]{
                Double.parseDouble(parts[0]),
                Double.parseDouble(parts[1]),
                Double.parseDouble(parts[2])
        };
    }
}
