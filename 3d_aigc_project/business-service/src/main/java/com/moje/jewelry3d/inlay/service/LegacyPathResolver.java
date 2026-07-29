package com.moje.jewelry3d.inlay.service;

import com.moje.jewelry3d.config.InlayDbConfig;
import com.moje.jewelry3d.config.InlayV2Config;
import com.moje.jewelry3d.inlay.entity.InlayAssetEntity;
import com.moje.jewelry3d.inlay.entity.InlayItemEntity;
import com.moje.jewelry3d.inlay.repository.InlayAssetRepository;
import com.moje.jewelry3d.inlay.repository.InlayItemRepository;
import com.moje.jewelry3d.inlay.util.InlayMeshMetadataUtil;
import com.moje.jewelry3d.service.InlayStructureService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Optional;

/**
 * 兼容旧 filePath / legacy_path 的网格路径解析，供融合管线使用
 */
@Slf4j
@Service
public class LegacyPathResolver {

    private static final List<String> MESH_EXTENSIONS = List.of(".obj", ".glb", ".stl");
    private static final List<String> ASSET_TYPES = List.of("mesh_glb", "mesh_obj", "mesh_stl");

    private final InlayV2Config v2Config;
    private final InlayDbConfig inlayDbConfig;
    private final InlayItemRepository itemRepository;
    private final InlayAssetRepository assetRepository;
    private final InlayStorageService storageService;
    private final InlayStructureService legacyService;

    public LegacyPathResolver(
            InlayV2Config v2Config,
            InlayDbConfig inlayDbConfig,
            InlayItemRepository itemRepository,
            InlayAssetRepository assetRepository,
            InlayStorageService storageService,
            InlayStructureService legacyService
    ) {
        this.v2Config = v2Config;
        this.inlayDbConfig = inlayDbConfig;
        this.itemRepository = itemRepository;
        this.assetRepository = assetRepository;
        this.storageService = storageService;
        this.legacyService = legacyService;
    }

    /**
     * 解析可用于 ai-service 的本地 mesh 绝对路径
     */
    public String resolveMeshPath(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return null;
        }

        if (v2Config.isEnabled()) {
            Optional<String> v2Path = resolveFromV2(identifier);
            if (v2Path.isPresent()) {
                return v2Path.get();
            }
        }

        if (v2Config.isLegacyFallback()) {
            return resolveFromLegacy(identifier);
        }

        return null;
    }

    private Optional<String> resolveFromV2(String identifier) {
        Optional<InlayItemEntity> itemOpt = itemRepository.findById(identifier);
        if (itemOpt.isEmpty()) {
            itemOpt = itemRepository.findByLegacyPath(identifier.replace('\\', '/'));
        }
        if (itemOpt.isEmpty()) {
            return Optional.empty();
        }

        InlayItemEntity item = itemOpt.get();
        if (!item.isMeshIsProxy() && item.isMeshReady()) {
            for (String assetType : ASSET_TYPES) {
                Optional<InlayAssetEntity> assetOpt = assetRepository.findByInlayIdAndAssetTypeAndCurrentTrue(item.getId(), assetType);
                if (assetOpt.isPresent()) {
                    return Optional.of(cacheMeshLocally(item.getId(), assetOpt.get()));
                }
            }
        }

        if (item.getLegacyPath() != null && v2Config.isLegacyFallback()) {
            try {
                return Optional.ofNullable(resolveFromLegacy(item.getLegacyPath()));
            } catch (Exception e) {
                log.debug("Legacy fallback for {} failed: {}", item.getLegacyPath(), e.getMessage());
            }
        }
        return Optional.empty();
    }

    private String cacheMeshLocally(String inlayId, InlayAssetEntity asset) {
        if (asset.getStorageKey().startsWith("legacy:")) {
            throw new RuntimeException("Mesh asset still uses legacy pointer: " + inlayId);
        }
        Path cacheDir = Paths.get(v2Config.getCacheDir()).toAbsolutePath().normalize();
        String ext = asset.getAssetType().contains("glb") ? ".glb"
                : asset.getAssetType().contains("stl") ? ".stl" : ".obj";

        for (String candidateExt : List.of(".glb", ".obj", ".stl")) {
            Path existing = cacheDir.resolve(inlayId + candidateExt);
            if (!Files.isRegularFile(existing)) {
                continue;
            }
            Optional<String> sniffed = sniffMeshExtension(existing);
            if (sniffed.isPresent() && sniffed.get().equals(candidateExt)) {
                return existing.toString();
            }
            try {
                Files.deleteIfExists(existing);
            } catch (IOException e) {
                log.warn("删除无效镶嵌缓存 {}: {}", existing, e.getMessage());
            }
        }

        Optional<Path> local = storageService.materializeLocal(asset.getStorageBucket(), asset.getStorageKey());
        try {
            Files.createDirectories(cacheDir);
            Path tempPath = cacheDir.resolve(inlayId + ".tmp");
            if (local.isPresent()) {
                Files.copy(local.get(), tempPath, StandardCopyOption.REPLACE_EXISTING);
            } else {
                try (InputStream stream = storageService.getObject(asset.getStorageBucket(), asset.getStorageKey()).orElseThrow()) {
                    Files.copy(stream, tempPath, StandardCopyOption.REPLACE_EXISTING);
                }
            }
            if (!Files.isRegularFile(tempPath)) {
                throw new RuntimeException("Cached mesh file missing after copy: " + tempPath);
            }

            String resolvedExt = sniffMeshExtension(tempPath).orElse(ext);
            Path cachePath = cacheDir.resolve(inlayId + resolvedExt);
            Files.move(tempPath, cachePath, StandardCopyOption.REPLACE_EXISTING);

            // 清理旧扩展名缓存（历史 bug 可能把 GLB 存成 .obj）
            for (String staleExt : List.of(".obj", ".glb", ".stl")) {
                if (staleExt.equals(resolvedExt)) {
                    continue;
                }
                Path stale = cacheDir.resolve(inlayId + staleExt);
                if (Files.isRegularFile(stale)) {
                    Files.deleteIfExists(stale);
                }
            }

            // ai-service 与 business-service 共享 inlay_cache 卷，必须返回该路径
            return cachePath.toString();
        } catch (Exception e) {
            throw new RuntimeException(
                    "Failed to cache mesh to shared inlay_cache for AI service: " + inlayId, e);
        }
    }

    /** 按文件头识别真实格式，避免 GLB 误标为 .obj 导致 ai-service 解析 0 顶点 */
    private Optional<String> sniffMeshExtension(Path file) {
        try {
            byte[] header = Files.readAllBytes(file);
            if (header.length >= 4
                    && header[0] == 'g' && header[1] == 'l' && header[2] == 'T' && header[3] == 'F') {
                return Optional.of(".glb");
            }
            int len = Math.min(header.length, 256);
            String text = new String(header, 0, len).stripLeading();
            if (text.startsWith("solid")) {
                return Optional.of(".stl");
            }
            if (text.startsWith("v ") || text.startsWith("#") || text.startsWith("o ")) {
                return Optional.of(".obj");
            }
        } catch (Exception e) {
            log.debug("sniffMeshExtension failed for {}: {}", file, e.getMessage());
        }
        return Optional.empty();
    }

    private String resolveFromLegacy(String filename) {
        Path filePath = legacyService.resolveStructureFile(filename);
        if (filePath == null) {
            throw new com.moje.jewelry3d.common.BusinessException(404, "镶嵌结构不存在: " + filename);
        }

        String ext = getExtension(filename).toLowerCase();
        if (MESH_EXTENSIONS.contains(ext)) {
            if (InlayMeshMetadataUtil.isKnownProxyObj(filePath)) {
                throw new com.moje.jewelry3d.common.BusinessException(
                        422, "镶嵌网格为占位 proxy，不可用: " + filename);
            }
            return filePath.toString();
        }

        String baseName = getBaseName(filePath.getFileName().toString());
        Path parent = filePath.getParent();
        for (String meshExt : MESH_EXTENSIONS) {
            Path candidate = parent.resolve(baseName + meshExt);
            if (Files.exists(candidate)) {
                if (InlayMeshMetadataUtil.isKnownProxyObj(candidate)) {
                    log.warn("跳过 proxy 伴生网格 {} -> {}", filename, candidate);
                    continue;
                }
                log.info("镶嵌文件 {} 使用伴生网格 {}", filename, candidate);
                return candidate.toString();
            }
        }
        throw new com.moje.jewelry3d.common.BusinessException(
                "镶嵌文件 " + filename + " 缺少 OBJ/GLB/STL 伴生网格，请先转换格式");
    }

    private static String getExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot) : "";
    }

    private static String getBaseName(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(0, dot) : filename;
    }
}
