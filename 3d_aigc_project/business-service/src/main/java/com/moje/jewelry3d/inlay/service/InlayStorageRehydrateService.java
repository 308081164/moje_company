package com.moje.jewelry3d.inlay.service;

import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.config.InlayDbConfig;
import com.moje.jewelry3d.config.InlayV2Config;
import com.moje.jewelry3d.inlay.entity.InlayAssetEntity;
import com.moje.jewelry3d.inlay.entity.InlayItemEntity;
import com.moje.jewelry3d.inlay.repository.InlayAssetRepository;
import com.moje.jewelry3d.inlay.repository.InlayItemRepository;
import com.moje.jewelry3d.inlay.util.InlayMeshMetadataUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.*;

/**
 * 将 legacy 文件夹中的资产复制到 v2 对象存储，消除 legacy: 指针依赖。
 */
@Slf4j
@Service
public class InlayStorageRehydrateService {

    private static final Set<String> PREVIEW_EXTENSIONS = Set.of(".png", ".jpg", ".jpeg", ".webp", ".bmp");
    private static final List<String> MESH_EXTENSIONS = List.of(".obj", ".glb", ".stl");

    private final InlayV2Config v2Config;
    private final InlayDbConfig inlayDbConfig;
    private final InlayItemRepository itemRepository;
    private final InlayAssetRepository assetRepository;
    private final InlayStorageService storageService;

    public InlayStorageRehydrateService(
            InlayV2Config v2Config,
            InlayDbConfig inlayDbConfig,
            InlayItemRepository itemRepository,
            InlayAssetRepository assetRepository,
            InlayStorageService storageService
    ) {
        this.v2Config = v2Config;
        this.inlayDbConfig = inlayDbConfig;
        this.itemRepository = itemRepository;
        this.assetRepository = assetRepository;
        this.storageService = storageService;
    }

    @Transactional
    public Map<String, Object> rehydrateAll(boolean force, boolean dryRun) {
        int ok = 0;
        int partial = 0;
        int fail = 0;
        int skipped = 0;
        Path dbRoot = legacyRootOrNull();

        for (InlayItemEntity item : itemRepository.findAll()) {
            try {
                RehydrateResult r = rehydrateItem(item, dbRoot, force, dryRun);
                switch (r) {
                    case OK -> ok++;
                    case PARTIAL -> partial++;
                    case SKIP -> skipped++;
                    default -> fail++;
                }
            } catch (Exception e) {
                fail++;
                log.warn("Rehydrate failed {}: {}", item.getId(), e.getMessage());
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("dry_run", dryRun);
        out.put("force", force);
        out.put("legacy_folder_available", dbRoot != null);
        out.put("ok", ok);
        out.put("partial", partial);
        out.put("skipped", skipped);
        out.put("fail", fail);
        out.put("total", ok + partial + skipped + fail);
        return out;
    }

    @Transactional
    public Map<String, Object> rehydrateOne(String inlayId, boolean force, boolean dryRun) {
        InlayItemEntity item = itemRepository.findById(inlayId)
                .orElseThrow(() -> new BusinessException(404, "镶嵌结构不存在: " + inlayId));
        RehydrateResult r = rehydrateItem(item, legacyRootOrNull(), force, dryRun);
        return Map.of(
                "inlay_id", inlayId,
                "result", r.name(),
                "dry_run", dryRun
        );
    }

    private enum RehydrateResult { OK, PARTIAL, SKIP, FAIL }

    private RehydrateResult rehydrateItem(InlayItemEntity item, Path dbRoot, boolean force, boolean dryRun) {
        if (item.getLegacyPath() == null || item.getLegacyPath().isBlank()) {
            return RehydrateResult.SKIP;
        }

        Path legacySource = dbRoot != null
                ? dbRoot.resolve(item.getLegacyPath().replace("/", dbRoot.getFileSystem().getSeparator()))
                : null;
        boolean sourceExists = legacySource != null && Files.isRegularFile(legacySource);

        int copied = 0;
        int needed = 0;

        // source JCD
        if (sourceExists && item.getPrimaryFormat().equalsIgnoreCase("JCD")) {
            needed++;
            if (ensureAsset(item, "source_jcd", storageService.sourceBucket(),
                    item.getId() + "/source.jcd", legacySource, force, dryRun)) {
                copied++;
            }
        }

        // mesh
        if (sourceExists) {
            Path parent = legacySource.getParent();
            String base = baseName(legacySource.getFileName().toString());
            for (String ext : MESH_EXTENSIONS) {
                Path meshPath = parent.resolve(base + ext);
                if (!Files.isRegularFile(meshPath)) continue;
                needed++;
                String meshType = "mesh_" + ext.substring(1);
                if (ensureAsset(item, meshType, storageService.meshBucket(),
                        item.getId() + "/mesh" + ext, meshPath, force, dryRun)) {
                    copied++;
                }
                syncMeshMetadata(item, meshPath);
                break;
            }
        }

        // preview
        if (sourceExists) {
            Path parent = legacySource.getParent();
            String base = baseName(legacySource.getFileName().toString());
            for (String ext : PREVIEW_EXTENSIONS) {
                Path previewPath = parent.resolve(base + ext);
                if (!Files.isRegularFile(previewPath)) continue;
                needed++;
                String assetType = ext.equals(".webp") ? "thumb_webp" : "preview_png";
                if (ensureAsset(item, assetType, storageService.previewBucket(),
                        item.getId() + "/thumb" + ext, previewPath, force, dryRun)) {
                    copied++;
                    item.setHasPreview(true);
                    item.setPreviewMethod(ext.equals(".bmp") ? "bmp" : "png");
                }
                break;
            }
        }

        // 修复已有 legacy: 指针（storage 已有文件则只更新 DB）
        for (InlayAssetEntity asset : assetRepository.findByInlayIdAndCurrentTrue(item.getId())) {
            if (!asset.getStorageKey().startsWith("legacy:")) continue;
            String properKey = deriveProperKey(item, asset.getAssetType());
            if (properKey == null) continue;
            if (!dryRun && storageService.exists(asset.getStorageBucket(), properKey)) {
                asset.setStorageKey(properKey);
                assetRepository.save(asset);
                copied++;
            } else if (sourceExists && !dryRun) {
                Path file = resolveLegacyAssetFile(legacySource, asset.getAssetType());
                if (file != null && ensureAsset(item, asset.getAssetType(), asset.getStorageBucket(),
                        properKey, file, true, false)) {
                    asset.setStorageKey(properKey);
                    assetRepository.save(asset);
                    copied++;
                }
            }
        }

        if (!dryRun) {
            syncMeshFromStorage(item);
            itemRepository.save(item);
        }

        if (needed == 0 && !hasLegacyPointers(item)) {
            return RehydrateResult.SKIP;
        }
        if (copied >= needed && !hasLegacyPointers(item)) {
            return RehydrateResult.OK;
        }
        if (copied > 0) {
            return RehydrateResult.PARTIAL;
        }
        return sourceExists ? RehydrateResult.FAIL : RehydrateResult.PARTIAL;
    }

    private boolean hasLegacyPointers(InlayItemEntity item) {
        return assetRepository.findByInlayIdAndCurrentTrue(item.getId()).stream()
                .anyMatch(a -> a.getStorageKey().startsWith("legacy:"));
    }

    private boolean ensureAsset(
            InlayItemEntity item, String assetType, String bucket, String key,
            Path sourcePath, boolean force, boolean dryRun
    ) {
        if (!force && storageService.exists(bucket, key)) {
            upsertAssetRecord(item, assetType, bucket, key, sourcePath, false);
            return true;
        }
        if (dryRun) {
            return true;
        }
        try {
            String contentType = Files.probeContentType(sourcePath);
            if (contentType == null) contentType = "application/octet-stream";
            try (InputStream in = Files.newInputStream(sourcePath)) {
                storageService.putObject(bucket, key, in, Files.size(sourcePath), contentType);
            }
            upsertAssetRecord(item, assetType, bucket, key, sourcePath, true);
            return true;
        } catch (IOException e) {
            log.warn("Copy to storage failed {}: {}", key, e.getMessage());
            return false;
        }
    }

    private void upsertAssetRecord(
            InlayItemEntity item, String assetType, String bucket, String key,
            Path sourcePath, boolean replaceCurrent
    ) {
        Optional<InlayAssetEntity> existing = assetRepository.findByInlayIdAndAssetTypeAndCurrentTrue(
                item.getId(), assetType);
        if (existing.isPresent() && !replaceCurrent
                && !existing.get().getStorageKey().startsWith("legacy:")) {
            return;
        }
        if (existing.isPresent()) {
            existing.get().setCurrent(false);
            assetRepository.save(existing.get());
        }
        InlayAssetEntity asset = new InlayAssetEntity();
        asset.setId(UUID.randomUUID().toString());
        asset.setInlayId(item.getId());
        asset.setAssetType(assetType);
        asset.setStorageBucket(bucket);
        asset.setStorageKey(key);
        try {
            asset.setSizeBytes(Files.size(sourcePath));
        } catch (IOException ignored) {}
        asset.setGeneratedAt(LocalDateTime.now());
        asset.setCurrent(true);
        assetRepository.save(asset);
    }

    public void syncMeshFromStorage(InlayItemEntity item) {
        Optional<Path> meshPath = resolveStoredMeshPath(item.getId());
        if (meshPath.isEmpty()) {
            item.setMeshReady(false);
            item.setMeshIsProxy(false);
            item.setMeshMethod(null);
            return;
        }
        InlayMeshMetadataUtil.MeshMeta meta = InlayMeshMetadataUtil.resolveMeshMeta(meshPath.get());
        if (meta == null) {
            item.setMeshReady(true);
            item.setMeshIsProxy(false);
            item.setMeshMethod("stored_obj");
            return;
        }
        item.setMeshMethod(meta.method());
        item.setMeshIsProxy(meta.isProxy());
        item.setMeshReady(!meta.isProxy());
    }

    public Optional<Path> resolveStoredMeshPath(String inlayId) {
        for (String type : List.of("mesh_glb", "mesh_obj", "mesh_stl")) {
            Optional<InlayAssetEntity> assetOpt = assetRepository.findByInlayIdAndAssetTypeAndCurrentTrue(inlayId, type);
            if (assetOpt.isEmpty()) continue;
            InlayAssetEntity asset = assetOpt.get();
            if (asset.getStorageKey().startsWith("legacy:")) continue;
            Optional<Path> local = storageService.materializeLocal(asset.getStorageBucket(), asset.getStorageKey());
            if (local.isPresent()) return local;
        }
        return Optional.empty();
    }

    public Optional<Path> resolveStoredSourcePath(String inlayId) {
        Optional<InlayAssetEntity> assetOpt = assetRepository.findByInlayIdAndAssetTypeAndCurrentTrue(inlayId, "source_jcd");
        if (assetOpt.isEmpty() || assetOpt.get().getStorageKey().startsWith("legacy:")) {
            return Optional.empty();
        }
        return storageService.materializeLocal(assetOpt.get().getStorageBucket(), assetOpt.get().getStorageKey());
    }

    private Path legacyRootOrNull() {
        Path dbRoot = Paths.get(inlayDbConfig.getPath()).toAbsolutePath().normalize();
        return Files.isDirectory(dbRoot) ? dbRoot : null;
    }

    private static String deriveProperKey(InlayItemEntity item, String assetType) {
        if (assetType.startsWith("mesh_")) {
            String ext = assetType.substring(5);
            return item.getId() + "/mesh." + ext;
        }
        if ("source_jcd".equals(assetType)) {
            return item.getId() + "/source.jcd";
        }
        if (assetType.contains("preview") || assetType.contains("thumb")) {
            return item.getId() + "/thumb.png";
        }
        return null;
    }

    private static Path resolveLegacyAssetFile(Path legacySource, String assetType) {
        Path parent = legacySource.getParent();
        String base = baseName(legacySource.getFileName().toString());
        if ("source_jcd".equals(assetType)) {
            return legacySource;
        }
        if (assetType.startsWith("mesh_")) {
            String ext = "." + assetType.substring(5);
            return parent.resolve(base + ext);
        }
        if (assetType.contains("preview") || assetType.contains("thumb")) {
            for (String ext : PREVIEW_EXTENSIONS) {
                Path p = parent.resolve(base + ext);
                if (Files.isRegularFile(p)) return p;
            }
        }
        return null;
    }

    private void syncMeshMetadata(InlayItemEntity item, Path meshPath) {
        InlayMeshMetadataUtil.MeshMeta meta = InlayMeshMetadataUtil.resolveMeshMeta(meshPath);
        if (meta == null) {
            item.setMeshReady(true);
            item.setMeshIsProxy(false);
            item.setMeshMethod("legacy_obj");
            return;
        }
        item.setMeshMethod(meta.method());
        item.setMeshIsProxy(meta.isProxy());
        item.setMeshReady(!meta.isProxy());
    }

    private static String baseName(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(0, dot) : filename;
    }

    /**
     * Worker 上传转换后的 mesh 到对象存储并更新元数据。
     */
    @Transactional
    public InlayItemEntity uploadMesh(
            String inlayId,
            InputStream meshStream,
            long sizeBytes,
            String meshMethod,
            boolean meshIsProxy
    ) {
        InlayItemEntity item = itemRepository.findById(inlayId)
                .orElseThrow(() -> new BusinessException(404, "镶嵌结构不存在: " + inlayId));
        String bucket = storageService.meshBucket();
        String key = inlayId + "/mesh.obj";
        storageService.putObject(bucket, key, meshStream, sizeBytes, "model/obj");

        Optional<InlayAssetEntity> existing = assetRepository.findByInlayIdAndAssetTypeAndCurrentTrue(
                inlayId, "mesh_obj");
        if (existing.isPresent()) {
            existing.get().setCurrent(false);
            assetRepository.save(existing.get());
        }
        InlayAssetEntity asset = new InlayAssetEntity();
        asset.setId(UUID.randomUUID().toString());
        asset.setInlayId(inlayId);
        asset.setAssetType("mesh_obj");
        asset.setStorageBucket(bucket);
        asset.setStorageKey(key);
        asset.setSizeBytes(sizeBytes);
        asset.setGeneratedAt(LocalDateTime.now());
        asset.setCurrent(true);
        assetRepository.save(asset);

        item.setMeshMethod(meshMethod != null ? meshMethod : "pointcloud_poisson");
        item.setMeshIsProxy(meshIsProxy);
        item.setMeshReady(!meshIsProxy);
        return itemRepository.save(item);
    }
}
