package com.moje.jewelry3d.inlay.service;

import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.config.InlayV2Config;
import com.moje.jewelry3d.inlay.dto.InlayItemDto;
import com.moje.jewelry3d.inlay.entity.InlayAssetEntity;
import com.moje.jewelry3d.inlay.entity.InlayItemEntity;
import com.moje.jewelry3d.inlay.entity.TagEntity;
import com.moje.jewelry3d.inlay.repository.InlayAssetRepository;
import com.moje.jewelry3d.inlay.repository.InlayItemRepository;
import com.moje.jewelry3d.inlay.repository.TagRepository;
import com.moje.jewelry3d.inlay.util.InlayMeshMetadataUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * 手动创建镶嵌库条目：文件直传对象存储，不依赖 legacy 文件夹。
 */
@Slf4j
@Service
public class InlayItemCreateService {

    private static final Set<String> PREVIEW_EXTS = Set.of(".png", ".jpg", ".jpeg", ".webp", ".bmp");
    private static final Set<String> MESH_EXTS = Set.of(".obj", ".glb", ".stl");

    private final InlayItemRepository itemRepository;
    private final InlayAssetRepository assetRepository;
    private final TagRepository tagRepository;
    private final InlayStorageService storageService;
    private final InlayCatalogService catalogService;
    private final InlayV2Config v2Config;

    public InlayItemCreateService(
            InlayItemRepository itemRepository,
            InlayAssetRepository assetRepository,
            TagRepository tagRepository,
            InlayStorageService storageService,
            InlayCatalogService catalogService,
            InlayV2Config v2Config
    ) {
        this.itemRepository = itemRepository;
        this.assetRepository = assetRepository;
        this.tagRepository = tagRepository;
        this.storageService = storageService;
        this.catalogService = catalogService;
        this.v2Config = v2Config;
    }

    public boolean isJcdUploadEnabled() {
        return v2Config.isMeshCropJcdEnabled();
    }

    public Set<String> allowedSourceExtensions() {
        if (v2Config.isMeshCropJcdEnabled()) {
            return Set.of(".jcd", ".obj", ".glb", ".stl");
        }
        return Set.of(".obj", ".glb", ".stl");
    }

    @Transactional
    public InlayItemDto createItem(
            MultipartFile source,
            MultipartFile preview,
            MultipartFile mesh,
            String displayName,
            String categoryId,
            List<String> tags,
            Float stoneDiameterMm,
            String inlayType
    ) throws IOException {
        if (source == null || source.isEmpty()) {
            throw new BusinessException(400, v2Config.isMeshCropJcdEnabled()
                    ? "请上传源文件（JCD / OBJ / GLB / STL）"
                    : "请上传源文件（OBJ / GLB / STL）");
        }

        String sourceName = sanitizeFilename(source.getOriginalFilename());
        String sourceExt = getExt(sourceName);
        if (!allowedSourceExtensions().contains(sourceExt)) {
            throw new BusinessException(400, "源文件格式不支持: " + sourceExt);
        }

        String id = UUID.randomUUID().toString();
        String legacyPath = "manual/" + id + "/" + sourceName;
        String primaryFormat = sourceExt.substring(1).toUpperCase(Locale.ROOT);
        boolean sourceIsMesh = MESH_EXTS.contains(sourceExt);

        InlayItemEntity item = new InlayItemEntity();
        item.setId(id);
        item.setLegacyPath(legacyPath);
        item.setDisplayName(displayName != null && !displayName.isBlank() ? displayName.trim() : stripExt(sourceName));
        item.setPrimaryFormat(primaryFormat);
        item.setCategoryId(categoryId);
        item.setStoneDiameterMm(stoneDiameterMm);
        item.setInlayType(inlayType);
        item.setStatus("active");
        item.setSourceLibrary("manual");
        item.setHasPreview(false);
        item.setMeshReady(false);
        item.setMeshIsProxy(false);

        if (sourceIsMesh) {
            storeMeshFile(item, source, sourceExt);
        } else {
            storeSourceJcd(item, source);
            if (mesh != null && !mesh.isEmpty()) {
                validateMeshFile(mesh);
                storeMeshFile(item, mesh, getExt(sanitizeFilename(mesh.getOriginalFilename())));
            }
        }

        if (preview != null && !preview.isEmpty()) {
            storePreviewFile(item, preview);
        }

        applyTags(item, tags);
        itemRepository.save(item);

        log.info("手动导入镶嵌条目 id={} name={} format={}", id, item.getDisplayName(), primaryFormat);
        return catalogService.getItem(id);
    }

    private void storeSourceJcd(InlayItemEntity item, MultipartFile file) throws IOException {
        String key = item.getId() + "/source.jcd";
        putMultipart(storageService.sourceBucket(), key, file, "application/octet-stream");
        saveAsset(item.getId(), "source_jcd", storageService.sourceBucket(), key, file.getSize(), null, null);
    }

    private void storeMeshFile(InlayItemEntity item, MultipartFile file, String ext) throws IOException {
        String meshType = "mesh_" + ext.substring(1);
        String key = item.getId() + "/mesh" + ext;
        Path temp = Files.createTempFile("inlay_mesh_", ext);
        try {
            file.transferTo(temp);
            long size = Files.size(temp);
            try (InputStream in = Files.newInputStream(temp)) {
                storageService.putObject(storageService.meshBucket(), key, in, size, contentTypeForExt(ext));
            }
            saveAsset(item.getId(), meshType, storageService.meshBucket(), key, size, null, null);

            InlayMeshMetadataUtil.MeshMeta meta = InlayMeshMetadataUtil.resolveMeshMeta(temp);
            if (meta != null) {
                item.setMeshMethod(meta.method());
                item.setMeshIsProxy(meta.isProxy());
                item.setMeshReady(!meta.isProxy());
            } else {
                item.setMeshMethod("uploaded" + ext);
                item.setMeshIsProxy(false);
                item.setMeshReady(true);
            }
        } finally {
            Files.deleteIfExists(temp);
        }
    }

    private void storePreviewFile(InlayItemEntity item, MultipartFile file) throws IOException {
        String name = sanitizeFilename(file.getOriginalFilename());
        String ext = getExt(name);
        if (!PREVIEW_EXTS.contains(ext)) {
            throw new BusinessException(400, "预览图格式不支持: " + ext);
        }
        String assetType = ext.equals(".webp") ? "thumb_webp" : "preview_png";
        String key = item.getId() + "/thumb" + ext;
        putMultipart(storageService.previewBucket(), key, file, contentTypeForExt(ext));
        saveAsset(item.getId(), assetType, storageService.previewBucket(), key, file.getSize(),
                ext.equals(".bmp") ? "bmp" : "upload", null);
        item.setHasPreview(true);
        item.setPreviewMethod(ext.equals(".bmp") ? "bmp" : "upload");
    }

    private void validateMeshFile(MultipartFile mesh) {
        String ext = getExt(sanitizeFilename(mesh.getOriginalFilename()));
        if (!MESH_EXTS.contains(ext)) {
            throw new BusinessException(400, "网格文件格式不支持: " + ext);
        }
    }

    private void putMultipart(String bucket, String key, MultipartFile file, String contentType) throws IOException {
        try (InputStream in = file.getInputStream()) {
            storageService.putObject(bucket, key, in, file.getSize(), contentType);
        }
    }

    private void saveAsset(
            String inlayId, String assetType, String bucket, String key,
            long size, String previewMethod, Float quality
    ) {
        assetRepository.findByInlayIdAndAssetTypeAndCurrentTrue(inlayId, assetType).ifPresent(old -> {
            old.setCurrent(false);
            assetRepository.save(old);
        });
        InlayAssetEntity asset = new InlayAssetEntity();
        asset.setId(UUID.randomUUID().toString());
        asset.setInlayId(inlayId);
        asset.setAssetType(assetType);
        asset.setStorageBucket(bucket);
        asset.setStorageKey(key);
        asset.setSizeBytes(size);
        asset.setPreviewMethod(previewMethod);
        asset.setQualityScore(quality);
        asset.setGeneratedAt(LocalDateTime.now());
        asset.setCurrent(true);
        assetRepository.save(asset);
    }

    private void applyTags(InlayItemEntity item, List<String> tags) {
        if (tags == null || tags.isEmpty()) return;
        for (String tagName : tags) {
            if (tagName == null || tagName.isBlank()) continue;
            TagEntity tag = tagRepository.findByName(tagName.trim()).orElseGet(() -> {
                TagEntity t = new TagEntity();
                t.setId(UUID.randomUUID().toString());
                t.setName(tagName.trim());
                return tagRepository.save(t);
            });
            item.getTags().add(tag);
        }
    }

    private static String sanitizeFilename(String name) {
        if (name == null || name.isBlank()) return "upload.bin";
        String base = Path.of(name).getFileName().toString();
        return base.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    private static String getExt(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot).toLowerCase(Locale.ROOT) : "";
    }

    private static String stripExt(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(0, dot) : filename;
    }

    private static String contentTypeForExt(String ext) {
        return switch (ext) {
            case ".png" -> "image/png";
            case ".jpg", ".jpeg" -> "image/jpeg";
            case ".webp" -> "image/webp";
            case ".bmp" -> "image/bmp";
            case ".obj" -> "model/obj";
            case ".glb" -> "model/gltf-binary";
            case ".stl" -> "model/stl";
            default -> "application/octet-stream";
        };
    }
}
