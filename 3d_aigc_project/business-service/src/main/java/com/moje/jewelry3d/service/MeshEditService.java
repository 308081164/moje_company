package com.moje.jewelry3d.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.config.AiServiceConfig;
import com.moje.jewelry3d.inlay.entity.InlayAssetEntity;
import com.moje.jewelry3d.inlay.entity.InlayItemEntity;
import com.moje.jewelry3d.inlay.repository.InlayAssetRepository;
import com.moje.jewelry3d.inlay.repository.InlayItemRepository;
import com.moje.jewelry3d.inlay.service.InlayStorageRehydrateService;
import com.moje.jewelry3d.inlay.service.InlayStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 网格编辑业务（转发 ai-service，供镶嵌库裁剪使用）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MeshEditService {

    private static final List<String> MESH_ASSET_TYPES = List.of("mesh_obj", "mesh_glb", "mesh_stl");

    private final AiServiceClient aiServiceClient;
    private final AiServiceConfig aiServiceConfig;
    private final InlayItemRepository itemRepository;
    private final InlayAssetRepository assetRepository;
    private final InlayStorageService storageService;
    private final InlayStorageRehydrateService rehydrateService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public Map<String, Object> sanitizeInlayMesh(String inlayId, boolean selectPrimary) {
        Path meshPath = resolveInlayMeshPath(inlayId);
        Path outputPath = editOutputPath(inlayId, "sanitized.glb");
        JsonNode result = aiServiceClient.callMeshSanitize(
                meshPath.toString(), outputPath.toString(), selectPrimary
        );
        if (!result.path("success").asBoolean(false)) {
            throw new BusinessException("网格清洗失败");
        }
        Path sanitized = Path.of(result.path("output_path").asText(outputPath.toString()));
        saveCroppedMeshToInlay(inlayId, sanitized, "sanitize");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("success", true);
        if (result.has("info") && !result.get("info").isNull()) {
            out.put("info", objectMapper.convertValue(result.get("info"), Map.class));
        }
        return out;
    }

    public JsonNode splitComponents(String inlayId) {
        Path meshPath = resolveInlayMeshPath(inlayId);
        JsonNode result = aiServiceClient.callMeshSplitComponents(meshPath.toString());
        if (!result.path("success").asBoolean(false)) {
            throw new BusinessException("连通分量拆分失败");
        }
        return result;
    }

    public Map<String, Object> mergeComponents(String inlayId, List<Integer> keepIndices, String outputFormat) {
        if (keepIndices == null || keepIndices.isEmpty()) {
            throw new BusinessException("请至少保留一个连通分量");
        }
        Path meshPath = resolveInlayMeshPath(inlayId);
        String fmt = normalizeFormat(outputFormat);
        Path outputPath = editOutputPath(inlayId, "merged." + fmt);
        try {
            String indicesJson = objectMapper.writeValueAsString(keepIndices);
            JsonNode result = aiServiceClient.callMeshMergeComponents(
                    meshPath.toString(), indicesJson, outputPath.toString(), fmt
            );
            if (!result.path("success").asBoolean(false)) {
                throw new BusinessException("分量合并失败");
            }
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("success", true);
            out.put("output_path", result.path("output_path").asText());
            out.put("kept_indices", keepIndices);
            out.put("source_component_count", result.path("source_component_count").asInt());
            out.put("output_face_count", result.path("output_face_count").asInt());
            return out;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("分量合并失败: " + e.getMessage(), e);
        }
    }

    public Map<String, Object> cropAndSave(String inlayId, List<Integer> keepIndices, String outputFormat) {
        Map<String, Object> merged = mergeComponents(inlayId, keepIndices, outputFormat);
        Path output = Path.of(merged.get("output_path").toString());
        saveCroppedMeshToInlay(inlayId, output, "component_crop");
        merged.put("saved", true);
        return merged;
    }

    public Map<String, Object> clipPlane(
            String inlayId,
            double[] origin,
            double[] normal,
            boolean keepPositive,
            String outputFormat,
            boolean save
    ) {
        Path meshPath = resolveInlayMeshPath(inlayId);
        String fmt = normalizeFormat(outputFormat);
        Path outputPath = editOutputPath(inlayId, "clipped." + fmt);
        try {
            String originJson = objectMapper.writeValueAsString(origin);
            String normalJson = objectMapper.writeValueAsString(normal);
            JsonNode result = aiServiceClient.callMeshClipPlane(
                    meshPath.toString(),
                    originJson,
                    normalJson,
                    keepPositive,
                    outputPath.toString(),
                    fmt
            );
            if (!result.path("success").asBoolean(false)) {
                throw new BusinessException("剖切失败");
            }
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("success", true);
            out.put("output_path", result.path("output_path").asText());
            out.put("output_face_count", result.path("output_face_count").asInt());
            if (save) {
                saveCroppedMeshToInlay(inlayId, Path.of(out.get("output_path").toString()), "clip_plane");
                out.put("saved", true);
            }
            return out;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("剖切失败: " + e.getMessage(), e);
        }
    }

    public Map<String, Object> booleanDifference(
            String inlayId,
            String subtractMeshPath,
            String outputFormat,
            boolean save
    ) {
        Path meshPath = resolveInlayMeshPath(inlayId);
        Path subtractPath = Path.of(subtractMeshPath);
        if (!Files.isRegularFile(subtractPath)) {
            throw new BusinessException("减除网格不存在: " + subtractMeshPath);
        }
        String fmt = normalizeFormat(outputFormat);
        Path outputPath = editOutputPath(inlayId, "boolean." + fmt);
        JsonNode result = aiServiceClient.callMeshBooleanDifference(
                meshPath.toString(),
                subtractPath.toString(),
                outputPath.toString(),
                fmt
        );
        if (!result.path("success").asBoolean(false)) {
            throw new BusinessException(result.path("detail").asText("布尔挖除失败，请改用分量裁剪"));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("success", true);
        out.put("output_path", result.path("output_path").asText());
        if (save) {
            saveCroppedMeshToInlay(inlayId, Path.of(out.get("output_path").toString()), "boolean_difference");
            out.put("saved", true);
        }
        return out;
    }

    public void saveCroppedMeshToInlay(String inlayId, Path croppedMeshPath, String meshMethod) {
        if (!Files.isRegularFile(croppedMeshPath)) {
            throw new BusinessException("裁剪结果不存在");
        }
        try {
            byte[] bytes = Files.readAllBytes(croppedMeshPath);
            rehydrateService.uploadMesh(
                    inlayId,
                    new ByteArrayInputStream(bytes),
                    bytes.length,
                    meshMethod != null ? meshMethod : "component_crop",
                    false
            );
            log.info("镶嵌 mesh 已保存 id={} method={} bytes={}", inlayId, meshMethod, bytes.length);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("保存裁剪 mesh 失败: " + e.getMessage(), e);
        }
    }

    public Path resolveInlayMeshPath(String inlayId) {
        InlayItemEntity item = itemRepository.findById(inlayId)
                .orElseThrow(() -> new BusinessException(404, "镶嵌项不存在"));
        if (!item.isMeshReady()) {
            throw new BusinessException("该镶嵌项 mesh 未就绪，请先转换或上传 OBJ/GLB/STL");
        }
        for (String type : MESH_ASSET_TYPES) {
            Optional<InlayAssetEntity> assetOpt =
                    assetRepository.findByInlayIdAndAssetTypeAndCurrentTrue(inlayId, type);
            if (assetOpt.isEmpty()) {
                continue;
            }
            InlayAssetEntity asset = assetOpt.get();
            if (asset.getStorageKey() != null && asset.getStorageKey().startsWith("legacy:")) {
                throw new BusinessException("legacy 存储需先执行 rehydrate-storage");
            }
            Optional<Path> local = storageService.materializeLocal(
                    asset.getStorageBucket(), asset.getStorageKey()
            );
            if (local.isPresent()) {
                return local.get().normalize();
            }
        }
        throw new BusinessException("无法读取镶嵌 mesh 文件");
    }

    private Path editOutputPath(String inlayId, String filename) {
        Path dir = aiServiceConfig.getOutputPath()
                .resolve("mesh-edit")
                .resolve("inlay")
                .resolve(inlayId);
        try {
            Files.createDirectories(dir);
            return dir.resolve(filename).normalize();
        } catch (Exception e) {
            throw new BusinessException("创建编辑输出目录失败: " + e.getMessage(), e);
        }
    }

    private static String normalizeFormat(String outputFormat) {
        String fmt = outputFormat != null ? outputFormat.toLowerCase() : "glb";
        if (!List.of("obj", "glb", "stl").contains(fmt)) {
            throw new BusinessException("不支持的输出格式: " + outputFormat);
        }
        return fmt;
    }
}
