package com.moje.jewelry3d.inlay.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.config.InlayDbConfig;
import com.moje.jewelry3d.inlay.entity.*;
import com.moje.jewelry3d.inlay.repository.*;
import com.moje.jewelry3d.inlay.util.InlayMeshMetadataUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Stream;

/**
 * 从 legacy 镶嵌结构数据库目录导入到 v2 元数据层
 */
@Slf4j
@Service
public class InlayImportService {

    private static final Set<String> MESH_FORMATS = Set.of("OBJ", "GLB", "STL");
    private static final Set<String> SUPPORTED_EXTENSIONS = Set.of(".jcd", ".obj", ".glb", ".stl");
    private static final Set<String> PREVIEW_EXTENSIONS = Set.of(".png", ".jpg", ".jpeg", ".webp", ".bmp");
    private static final DateTimeFormatter DT_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final InlayDbConfig inlayDbConfig;
    private final InlayItemRepository itemRepository;
    private final InlayAssetRepository assetRepository;
    private final InlayAliasRepository aliasRepository;
    private final InlayJobLogRepository jobLogRepository;
    private final InlayStorageService storageService;
    private final ObjectMapper objectMapper;

    public InlayImportService(
            InlayDbConfig inlayDbConfig,
            InlayItemRepository itemRepository,
            InlayAssetRepository assetRepository,
            InlayAliasRepository aliasRepository,
            InlayJobLogRepository jobLogRepository,
            InlayStorageService storageService,
            ObjectMapper objectMapper
    ) {
        this.inlayDbConfig = inlayDbConfig;
        this.itemRepository = itemRepository;
        this.assetRepository = assetRepository;
        this.aliasRepository = aliasRepository;
        this.jobLogRepository = jobLogRepository;
        this.storageService = storageService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public Map<String, Object> importLegacyDirectory(boolean dryRun) {
        Path dbRoot = Paths.get(inlayDbConfig.getPath()).toAbsolutePath().normalize();
        if (!Files.isDirectory(dbRoot)) {
            throw new BusinessException("镶嵌结构数据库目录不存在: " + dbRoot);
        }

        Set<String> allPaths = new HashSet<>();
        List<ScannedFile> files = new ArrayList<>();

        try (Stream<Path> paths = Files.walk(dbRoot)) {
            paths.filter(Files::isRegularFile).forEach(path -> {
                String rel = dbRoot.relativize(path).toString().replace('\\', '/');
                allPaths.add(rel);
                if (isSupported(path) && !isArchive(rel)) {
                    try {
                        files.add(new ScannedFile(path, rel, Files.readAttributes(path, BasicFileAttributes.class)));
                    } catch (IOException e) {
                        log.warn("Skip {}: {}", rel, e.getMessage());
                    }
                }
            });
        } catch (IOException e) {
            throw new BusinessException("扫描失败: " + e.getMessage());
        }

        Map<String, ScannedFile> jcdByBase = new LinkedHashMap<>();
        Map<String, ScannedFile> meshByBase = new LinkedHashMap<>();
        Map<String, ScannedFile> orphanMesh = new LinkedHashMap<>();

        for (ScannedFile f : files) {
            String ext = getExt(f.filename()).toUpperCase().replace(".", "");
            String baseKey = f.parentRel() + "/" + getBaseName(f.filename());
            if ("JCD".equals(ext)) {
                jcdByBase.putIfAbsent(baseKey, f);
            } else if (MESH_FORMATS.contains(ext)) {
                String jcdKey = f.parentRel() + "/" + getBaseName(f.filename());
                if (allPaths.contains(joinRel(f.parentRel(), getBaseName(f.filename()) + ".jcd"))) {
                    meshByBase.put(jcdKey, f);
                } else {
                    orphanMesh.put(baseKey, f);
                }
            }
        }

        int imported = 0;
        int skipped = 0;

        if (!dryRun) {
            for (ScannedFile jcd : jcdByBase.values()) {
                if (itemRepository.findByLegacyPath(jcd.rel()).isPresent()) {
                    skipped++;
                    continue;
                }
                importJcdRecord(jcd, meshByBase.get(jcd.parentRel() + "/" + getBaseName(jcd.filename())), allPaths);
                imported++;
            }
            for (ScannedFile mesh : orphanMesh.values()) {
                if (itemRepository.findByLegacyPath(mesh.rel()).isPresent()) {
                    skipped++;
                    continue;
                }
                importOrphanMesh(mesh, allPaths);
                imported++;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("dry_run", dryRun);
        result.put("jcd_candidates", jcdByBase.size());
        result.put("orphan_mesh", orphanMesh.size());
        result.put("imported", imported);
        result.put("skipped", skipped);
        result.put("total_files", files.size());
        log.info("Legacy import: {}", result);
        return result;
    }

    private void importJcdRecord(ScannedFile jcd, ScannedFile mesh, Set<String> allPaths) {
        InlayItemEntity item = new InlayItemEntity();
        item.setId(UUID.randomUUID().toString());
        item.setLegacyPath(jcd.rel());
        item.setDisplayName(jcd.filename());
        item.setPrimaryFormat("JCD");
        item.setSourceLibrary(extractSourceLibrary(jcd.rel()));
        applyMeshMetadata(item, mesh != null ? mesh.path() : null);
        item.setStatus("active");

        enrichPreviewInfo(item, jcd, allPaths);
        itemRepository.save(item);

        registerAsset(item, "source_jcd", storageService.sourceBucket(),
                item.getId() + "/source.jcd", jcd.path(), null, null);

        if (mesh != null) {
            String meshType = "mesh_" + getExt(mesh.filename()).replace(".", "").toLowerCase();
            registerAsset(item, meshType, storageService.meshBucket(),
                    item.getId() + "/mesh" + getExt(mesh.filename()), mesh.path(), null, null);
        }

        logJob("migrate", item.getId(), "ok", "jcd", Map.of("legacy_path", jcd.rel()));
    }

    private void applyMeshMetadata(InlayItemEntity item, Path meshPath) {
        if (meshPath == null || !Files.isRegularFile(meshPath)) {
            item.setMeshReady(false);
            item.setMeshIsProxy(false);
            item.setMeshMethod(null);
            return;
        }
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

    private void importOrphanMesh(ScannedFile mesh, Set<String> allPaths) {
        InlayItemEntity item = new InlayItemEntity();
        item.setId(UUID.randomUUID().toString());
        item.setLegacyPath(mesh.rel());
        item.setDisplayName(mesh.filename());
        item.setPrimaryFormat(getExt(mesh.filename()).replace(".", "").toUpperCase());
        item.setSourceLibrary(extractSourceLibrary(mesh.rel()));
        applyMeshMetadata(item, mesh.path());
        item.setStatus("active");
        enrichPreviewInfo(item, mesh, allPaths);
        itemRepository.save(item);

        String meshType = "mesh_" + getExt(mesh.filename()).replace(".", "").toLowerCase();
        registerAsset(item, meshType, storageService.meshBucket(),
                item.getId() + "/mesh" + getExt(mesh.filename()), mesh.path(), null, null);
    }

    private void enrichPreviewInfo(InlayItemEntity item, ScannedFile source, Set<String> allPaths) {
        String baseName = getBaseName(source.filename());
        for (String ext : PREVIEW_EXTENSIONS) {
            String previewRel = joinRel(source.parentRel(), baseName + ext);
            if (allPaths.contains(previewRel)) {
                item.setHasPreview(true);
                item.setPreviewMethod(ext.equals(".bmp") ? "bmp" : "png");
                Path previewPath = source.path().getParent().resolve(baseName + ext);
                registerAsset(item, ext.equals(".webp") ? "thumb_webp" : "preview_png",
                        storageService.previewBucket(), item.getId() + "/thumb" + ext, previewPath,
                        item.getPreviewMethod(), null);
                return;
            }
        }
    }

    private void registerAsset(InlayItemEntity item, String assetType, String bucket, String key,
                               Path sourcePath, String previewMethod, Float quality) {
        if (key.startsWith("legacy:")) {
            throw new BusinessException("禁止写入 legacy: 存储键，请先复制到对象存储");
        }
        try {
            String contentType = Files.probeContentType(sourcePath);
            if (contentType == null) contentType = "application/octet-stream";
            if (!storageService.exists(bucket, key)) {
                try (var in = Files.newInputStream(sourcePath)) {
                    storageService.putObject(bucket, key, in, Files.size(sourcePath), contentType);
                }
            }
        } catch (Exception e) {
            throw new BusinessException("资产复制到对象存储失败: " + key + " — " + e.getMessage());
        }

        Optional<InlayAssetEntity> existing = assetRepository.findByInlayIdAndAssetTypeAndCurrentTrue(
                item.getId(), assetType);
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
        asset.setPreviewMethod(previewMethod);
        asset.setQualityScore(quality);
        asset.setGeneratedAt(LocalDateTime.now());
        asset.setCurrent(true);
        assetRepository.save(asset);
    }

    private void logJob(String type, String inlayId, String status, String method, Map<String, Object> detail) {
        InlayJobLogEntity jobLog = new InlayJobLogEntity();
        jobLog.setId(UUID.randomUUID().toString());
        jobLog.setJobType(type);
        jobLog.setInlayId(inlayId);
        jobLog.setStatus(status);
        jobLog.setMethod(method);
        try {
            jobLog.setDetailJson(objectMapper.writeValueAsString(detail));
        } catch (Exception e) {
            jobLog.setDetailJson("{}");
        }
        jobLogRepository.save(jobLog);
    }

    private static String extractSourceLibrary(String rel) {
        int slash = rel.indexOf('/');
        return slash > 0 ? rel.substring(0, slash) : "";
    }

    private static boolean isSupported(Path path) {
        String name = path.getFileName().toString().toLowerCase();
        int dot = name.lastIndexOf('.');
        return dot >= 0 && SUPPORTED_EXTENSIONS.contains(name.substring(dot));
    }

    private static boolean isArchive(String rel) {
        return rel.contains("/_jcd_archive/") || rel.startsWith("_jcd_archive/");
    }

    private static String getExt(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot).toLowerCase() : "";
    }

    private static String getBaseName(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(0, dot) : filename;
    }

    private static String joinRel(String parent, String name) {
        return parent.isEmpty() ? name : parent + "/" + name;
    }

    private record ScannedFile(Path path, String rel, BasicFileAttributes attrs) {
        String filename() { return path.getFileName().toString(); }
        String parentRel() {
            int slash = rel.lastIndexOf('/');
            return slash >= 0 ? rel.substring(0, slash) : "";
        }
    }
}
