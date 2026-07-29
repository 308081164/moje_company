package com.moje.jewelry3d.inlay.controller;

import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.common.Result;
import com.moje.jewelry3d.config.InlayV2Config;
import com.moje.jewelry3d.inlay.dto.*;
import com.moje.jewelry3d.inlay.entity.CategoryEntity;
import com.moje.jewelry3d.inlay.entity.InlayPreviewJobEntity;
import com.moje.jewelry3d.inlay.entity.TagEntity;
import com.moje.jewelry3d.inlay.service.InlayCatalogService;
import com.moje.jewelry3d.inlay.service.InlayImportService;
import com.moje.jewelry3d.inlay.service.InlayItemCreateService;
import com.moje.jewelry3d.inlay.service.InlayPreviewJobService;
import com.moje.jewelry3d.inlay.service.InlayStorageRehydrateService;
import com.moje.jewelry3d.model.dto.InlayCategoryNode;
import com.moje.jewelry3d.service.MeshEditService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StreamUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 镶嵌库 v2 REST API（PostgreSQL/SQLite + MinIO/本地存储）
 */
@Slf4j
@RestController
@RequestMapping("/api/inlay/v2")
public class InlayV2Controller {

    private final InlayV2Config v2Config;
    private final InlayCatalogService catalogService;
    private final InlayImportService importService;
    private final InlayPreviewJobService previewJobService;
    private final InlayStorageRehydrateService rehydrateService;
    private final InlayItemCreateService itemCreateService;
    private final MeshEditService meshEditService;

    @Autowired
    public InlayV2Controller(
            InlayV2Config v2Config,
            InlayCatalogService catalogService,
            InlayImportService importService,
            InlayPreviewJobService previewJobService,
            InlayStorageRehydrateService rehydrateService,
            InlayItemCreateService itemCreateService,
            MeshEditService meshEditService
    ) {
        this.v2Config = v2Config;
        this.catalogService = catalogService;
        this.importService = importService;
        this.previewJobService = previewJobService;
        this.rehydrateService = rehydrateService;
        this.itemCreateService = itemCreateService;
        this.meshEditService = meshEditService;
    }

    private void ensureEnabled() {
        if (!v2Config.isEnabled()) {
            throw new BusinessException(503, "镶嵌库 v2 未启用");
        }
    }

    @GetMapping("/items")
    public Result<InlayItemPageDto> listItems(
            @RequestParam(required = false) String q,
            @RequestParam(name = "category_id", required = false) String categoryId,
            @RequestParam(required = false) String tags,
            @RequestParam(name = "inlay_type", required = false) String inlayType,
            @RequestParam(name = "mesh_ready", required = false) Boolean meshReady,
            @RequestParam(name = "has_preview", required = false) Boolean hasPreview,
            @RequestParam(name = "preview_method", required = false) String previewMethod,
            @RequestParam(name = "stone_diameter_min", required = false) Float stoneDiameterMin,
            @RequestParam(name = "stone_diameter_max", required = false) Float stoneDiameterMax,
            @RequestParam(required = false) String status,
            @RequestParam(required = false, defaultValue = "updated_at:desc") String sort,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(name = "page_size", defaultValue = "50") int pageSize,
            @RequestParam(name = "legacy_path", required = false) String legacyPath
    ) {
        ensureEnabled();
        InlayItemQueryDto query = InlayItemQueryDto.builder()
                .q(q)
                .categoryId(categoryId)
                .tags(tags)
                .inlayType(inlayType)
                .meshReady(meshReady)
                .hasPreview(hasPreview)
                .previewMethod(previewMethod)
                .stoneDiameterMin(stoneDiameterMin)
                .stoneDiameterMax(stoneDiameterMax)
                .status(status)
                .sort(sort)
                .page(page)
                .pageSize(pageSize)
                .legacyPath(legacyPath)
                .build();
        return Result.success(catalogService.queryItems(query));
    }

    /**
     * 手动新建镶嵌条目：源文件 + 可选预览图 + 可选 mesh，直传对象存储。
     */
    @PostMapping(value = "/items", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Result<InlayItemDto> createItem(
            @RequestParam("source") MultipartFile source,
            @RequestParam(value = "preview", required = false) MultipartFile preview,
            @RequestParam(value = "mesh", required = false) MultipartFile mesh,
            @RequestParam(value = "display_name", required = false) String displayName,
            @RequestParam(value = "category_id", required = false) String categoryId,
            @RequestParam(value = "tags", required = false) String tags,
            @RequestParam(value = "stone_diameter_mm", required = false) Float stoneDiameterMm,
            @RequestParam(value = "inlay_type", required = false) String inlayType
    ) {
        ensureEnabled();
        try {
            List<String> tagList = tags == null || tags.isBlank()
                    ? List.of()
                    : List.of(tags.split("[,，;；]")).stream().map(String::trim).filter(s -> !s.isEmpty()).toList();
            InlayItemDto dto = itemCreateService.createItem(
                    source, preview, mesh, displayName, categoryId, tagList, stoneDiameterMm, inlayType);
            if (dto.isMeshReady()) {
                try {
                    meshEditService.sanitizeInlayMesh(dto.getId(), true);
                    dto = catalogService.getItem(dto.getId());
                } catch (Exception sanitizeError) {
                    log.warn("导入后自动 sanitize 失败 id={}: {}", dto.getId(), sanitizeError.getMessage());
                }
            }
            return Result.success("导入成功", dto);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("导入失败: " + e.getMessage());
        }
    }

    @GetMapping("/items/{id}")
    public Result<InlayItemDto> getItem(@PathVariable String id) {
        ensureEnabled();
        return Result.success(catalogService.getItem(id));
    }

    @GetMapping("/items/by-legacy-path")
    public Result<InlayItemDto> getByLegacyPath(@RequestParam String path) {
        ensureEnabled();
        return Result.success(catalogService.getByLegacyPath(path));
    }

    @GetMapping("/items/{id}/thumbnail")
    public ResponseEntity<?> getThumbnail(@PathVariable String id) {
        ensureEnabled();
        return catalogService.getThumbnail(id)
                .map(this::streamAsset)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/items/{id}/mesh")
    public ResponseEntity<?> getMesh(@PathVariable String id) {
        ensureEnabled();
        return catalogService.getMesh(id, false)
                .map(this::streamAsset)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/items/{id}/mesh/glb")
    public ResponseEntity<?> getMeshGlb(@PathVariable String id) {
        ensureEnabled();
        return catalogService.getMesh(id, true)
                .map(this::streamAsset)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PatchMapping("/items/{id}")
    public Result<InlayItemDto> patchItem(@PathVariable String id, @RequestBody InlayItemPatchDto patch) {
        ensureEnabled();
        return Result.success(catalogService.patchItem(id, patch));
    }

    @PostMapping("/items/batch")
    public Result<Map<String, Object>> batchUpdate(@RequestBody InlayBatchRequestDto req) {
        ensureEnabled();
        int updated = catalogService.batchUpdate(req);
        return Result.success(Map.of("updated", updated));
    }

    @DeleteMapping("/items/{id}")
    public Result<Void> deleteItem(@PathVariable String id) {
        ensureEnabled();
        catalogService.deleteItem(id);
        return Result.success(null);
    }

    @PostMapping("/items/batch-delete")
    public Result<Map<String, Object>> batchDelete(@RequestBody InlayBatchRequestDto req) {
        ensureEnabled();
        int deleted = catalogService.batchDeleteItems(req.getIds());
        return Result.success(Map.of("deleted", deleted));
    }

    @PostMapping("/items/{id}/move")
    public Result<InlayItemDto> moveItem(
            @PathVariable String id,
            @RequestBody Map<String, String> body
    ) {
        ensureEnabled();
        return Result.success(catalogService.moveItem(id, body.get("category_id")));
    }

    @PostMapping("/items/{id}/regenerate-preview")
    public Result<Map<String, String>> regeneratePreview(@PathVariable String id) {
        ensureEnabled();
        InlayPreviewJobEntity job = previewJobService.enqueue(id, "preview", 10);
        return Result.success(Map.of("job_id", job.getId(), "status", job.getStatus()));
    }

    @PostMapping("/items/{id}/convert-mesh")
    public Result<Map<String, String>> convertMesh(@PathVariable String id) {
        ensureEnabled();
        InlayPreviewJobEntity job = previewJobService.enqueue(id, "mesh", 5);
        return Result.success(Map.of("job_id", job.getId(), "status", job.getStatus()));
    }

    @PostMapping("/items/{id}/sync-mesh")
    public Result<InlayItemDto> syncMesh(@PathVariable String id) {
        ensureEnabled();
        return Result.success(catalogService.syncMeshFromDisk(id));
    }

    @GetMapping("/categories")
    public Result<List<InlayCategoryNode>> getCategories() {
        ensureEnabled();
        return Result.success(catalogService.getCategoryTree());
    }

    @PostMapping("/categories")
    public Result<CategoryEntity> createCategory(@RequestBody Map<String, String> body) {
        ensureEnabled();
        return Result.success(catalogService.createCategory(body.get("name"), body.get("parent_id")));
    }

    @GetMapping("/tags")
    public Result<List<TagEntity>> getTags() {
        ensureEnabled();
        return Result.success(catalogService.listTags());
    }

    @PostMapping("/tags")
    public Result<TagEntity> createTag(@RequestBody Map<String, String> body) {
        ensureEnabled();
        return Result.success(catalogService.createTag(body.get("name"), body.get("color")));
    }

    @GetMapping("/stats")
    public Result<InlayStatsDto> getStats() {
        ensureEnabled();
        return Result.success(catalogService.getStats());
    }

    @GetMapping("/jobs")
    public Result<List<InlayPreviewJobEntity>> listJobs(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "20") int limit
    ) {
        ensureEnabled();
        return Result.success(previewJobService.listJobs(status, limit));
    }

    /** Worker 领取下一任务 */
    @PostMapping("/jobs/claim")
    public Result<InlayPreviewJobEntity> claimJob() {
        ensureEnabled();
        return previewJobService.claimNextJob()
                .map(Result::success)
                .orElse(Result.success(null));
    }

    @PostMapping("/jobs/{jobId}/complete")
    public Result<Void> completeJob(
            @PathVariable String jobId,
            @RequestBody Map<String, Object> body
    ) {
        ensureEnabled();
        boolean success = Boolean.TRUE.equals(body.get("success"));
        String error = body.get("error") != null ? body.get("error").toString() : null;
        previewJobService.completeJob(jobId, success, error);
        return Result.success(null);
    }

    @PostMapping("/import/scan-legacy")
    public Result<Map<String, Object>> importLegacy(
            @RequestParam(name = "dry_run", defaultValue = "false") boolean dryRun
    ) {
        ensureEnabled();
        return Result.success(importService.importLegacyDirectory(dryRun));
    }

    /** 从 legacy 目录 sidecar 批量回写 mesh 元数据（重建 OBJ 后调用） */
    @PostMapping("/import/sync-mesh-metadata")
    public Result<Map<String, Object>> syncMeshMetadata() {
        ensureEnabled();
        return Result.success(catalogService.syncAllMeshFromLegacy());
    }

    /**
     * 一次性迁移：将 legacy 文件夹中的 JCD/mesh/预览复制到对象存储，消除 legacy: 依赖。
     * 在删除「镶嵌结构数据库/」文件夹前必须执行且 ok&gt;0。
     */
    @PostMapping("/import/rehydrate-storage")
    public Result<Map<String, Object>> rehydrateStorage(
            @RequestParam(name = "force", defaultValue = "false") boolean force,
            @RequestParam(name = "dry_run", defaultValue = "false") boolean dryRun
    ) {
        ensureEnabled();
        return Result.success(rehydrateService.rehydrateAll(force, dryRun));
    }

    @PostMapping("/items/{id}/rehydrate-storage")
    public Result<Map<String, Object>> rehydrateOne(
            @PathVariable String id,
            @RequestParam(name = "force", defaultValue = "false") boolean force,
            @RequestParam(name = "dry_run", defaultValue = "false") boolean dryRun
    ) {
        ensureEnabled();
        return Result.success(rehydrateService.rehydrateOne(id, force, dryRun));
    }

    @GetMapping("/items/{id}/source-jcd")
    public ResponseEntity<?> getSourceJcd(@PathVariable String id) {
        ensureEnabled();
        return catalogService.getSourceJcd(id)
                .map(this::streamAsset)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping(value = "/items/{id}/mesh", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Result<InlayItemDto> uploadMesh(
            @PathVariable String id,
            @RequestParam("file") MultipartFile file,
            @RequestParam(name = "mesh_method", required = false) String meshMethod,
            @RequestParam(name = "mesh_is_proxy", defaultValue = "false") boolean meshIsProxy
    ) {
        ensureEnabled();
        try {
            var item = rehydrateService.uploadMesh(
                    id, file.getInputStream(), file.getSize(), meshMethod, meshIsProxy);
            return Result.success(catalogService.toDtoPublic(item));
        } catch (Exception e) {
            throw new BusinessException("上传 mesh 失败: " + e.getMessage());
        }
    }

    @GetMapping("/config")
    public Result<Map<String, Object>> getConfig() {
        Map<String, Object> cfg = new LinkedHashMap<>();
        cfg.put("enabled", v2Config.isEnabled());
        cfg.put("legacy_fallback", v2Config.isLegacyFallback());
        cfg.put("v1_index_enabled", v2Config.isV1IndexEnabled());
        cfg.put("storage_mode", v2Config.getStorage().getMode());
        cfg.put("queue_type", v2Config.getQueue().getType());
        cfg.put("mesh_crop_jcd_enabled", v2Config.isMeshCropJcdEnabled());
        cfg.put("allowed_source_exts", itemCreateService.allowedSourceExtensions());
        return Result.success(cfg);
    }

    private ResponseEntity<InputStreamResource> streamAsset(InlayCatalogService.AssetStream asset) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(asset.contentType()));
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + asset.filename() + "\"");
        long maxAge = v2Config.getCache().getThumbnailMaxAge();
        if (v2Config.getCache().isImmutableThumbnails()) {
            headers.setCacheControl("public, max-age=" + maxAge + ", immutable");
        } else {
            headers.setCacheControl("public, max-age=" + maxAge);
        }
        InputStreamResource resource = new InputStreamResource(asset.stream());
        if (asset.size() > 0) {
            return ResponseEntity.ok().headers(headers).contentLength(asset.size()).body(resource);
        }
        return ResponseEntity.ok().headers(headers).body(resource);
    }
}
