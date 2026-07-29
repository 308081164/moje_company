package com.moje.jewelry3d.inlay.service;

import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.config.InlayDbConfig;
import com.moje.jewelry3d.config.InlayV2Config;
import com.moje.jewelry3d.inlay.dto.*;
import com.moje.jewelry3d.inlay.entity.*;
import com.moje.jewelry3d.inlay.repository.*;
import com.moje.jewelry3d.inlay.util.InlayMeshMetadataUtil;
import com.moje.jewelry3d.model.dto.InlayCategoryNode;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class InlayCatalogService {

    private static final DateTimeFormatter DT_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final InlayV2Config v2Config;
    private final InlayDbConfig inlayDbConfig;
    private final InlayItemRepository itemRepository;
    private final InlayAssetRepository assetRepository;
    private final CategoryRepository categoryRepository;
    private final TagRepository tagRepository;
    private final InlayStorageService storageService;
    private final InlayPreviewJobService previewJobService;
    private final InlayPreviewJobRepository previewJobRepository;
    private final InlayStorageRehydrateService rehydrateService;

    public InlayCatalogService(
            InlayV2Config v2Config,
            InlayDbConfig inlayDbConfig,
            InlayItemRepository itemRepository,
            InlayAssetRepository assetRepository,
            CategoryRepository categoryRepository,
            TagRepository tagRepository,
            InlayStorageService storageService,
            InlayPreviewJobService previewJobService,
            InlayPreviewJobRepository previewJobRepository,
            InlayStorageRehydrateService rehydrateService
    ) {
        this.v2Config = v2Config;
        this.inlayDbConfig = inlayDbConfig;
        this.itemRepository = itemRepository;
        this.assetRepository = assetRepository;
        this.categoryRepository = categoryRepository;
        this.tagRepository = tagRepository;
        this.storageService = storageService;
        this.previewJobService = previewJobService;
        this.previewJobRepository = previewJobRepository;
        this.rehydrateService = rehydrateService;
    }

    public InlayItemPageDto queryItems(InlayItemQueryDto query) {
        if (query.getLegacyPath() != null && !query.getLegacyPath().isBlank()) {
            InlayItemEntity item = itemRepository.findByLegacyPath(query.getLegacyPath().replace('\\', '/'))
                    .orElseThrow(() -> new BusinessException(404, "未找到: " + query.getLegacyPath()));
            return InlayItemPageDto.builder()
                    .items(List.of(toDto(item)))
                    .total(1)
                    .page(1)
                    .pageSize(1)
                    .stats(buildStats())
                    .build();
        }

        int page = Math.max(query.getPage(), 1);
        int pageSize = Math.min(Math.max(query.getPageSize(), 1), 200);
        Sort sort = parseSort(query.getSort());
        PageRequest pageable = PageRequest.of(page - 1, pageSize, sort);

        Specification<InlayItemEntity> spec = buildSpec(query);
        Page<InlayItemEntity> result = itemRepository.findAll(spec, pageable);

        return InlayItemPageDto.builder()
                .items(result.getContent().stream().map(this::toDto).toList())
                .total(result.getTotalElements())
                .page(page)
                .pageSize(pageSize)
                .stats(buildStats())
                .build();
    }

    public InlayItemDto getItem(String id) {
        InlayItemEntity item = itemRepository.findByIdWithTags(id)
                .orElseThrow(() -> new BusinessException(404, "镶嵌结构不存在: " + id));
        return toDto(item);
    }

    public InlayItemDto getByLegacyPath(String path) {
        InlayItemEntity item = itemRepository.findByLegacyPath(path.replace('\\', '/'))
                .orElseThrow(() -> new BusinessException(404, "未找到 legacy_path: " + path));
        return toDto(item);
    }

    @Transactional
    public InlayItemDto patchItem(String id, InlayItemPatchDto patch) {
        InlayItemEntity item = itemRepository.findByIdWithTags(id)
                .orElseThrow(() -> new BusinessException(404, "镶嵌结构不存在: " + id));

        if (patch.getDisplayName() != null) item.setDisplayName(patch.getDisplayName());
        if (patch.getCategoryId() != null) item.setCategoryId(patch.getCategoryId());
        if (patch.getInlayType() != null) item.setInlayType(patch.getInlayType());
        if (patch.getStatus() != null) item.setStatus(patch.getStatus());
        if (patch.getStoneDiameterMm() != null) item.setStoneDiameterMm(patch.getStoneDiameterMm());

        if (patch.getTags() != null) {
            item.getTags().clear();
            for (String tagName : patch.getTags()) {
                TagEntity tag = tagRepository.findByName(tagName)
                        .orElseGet(() -> {
                            TagEntity t = new TagEntity();
                            t.setId(UUID.randomUUID().toString());
                            t.setName(tagName);
                            return tagRepository.save(t);
                        });
                item.getTags().add(tag);
            }
        }

        return toDto(itemRepository.save(item));
    }

    @Transactional
    public int batchUpdate(InlayBatchRequestDto req) {
        if (req.getIds() == null || req.getIds().isEmpty()) return 0;
        int count = 0;
        for (String id : req.getIds()) {
            InlayItemEntity item = itemRepository.findByIdWithTags(id).orElse(null);
            if (item == null) continue;
            if (req.getCategoryId() != null) item.setCategoryId(req.getCategoryId());
            if (req.getStatus() != null) item.setStatus(req.getStatus());
            if (req.getAddTags() != null) {
                for (String tagName : req.getAddTags()) {
                    TagEntity tag = tagRepository.findByName(tagName).orElseGet(() -> {
                        TagEntity t = new TagEntity();
                        t.setId(UUID.randomUUID().toString());
                        t.setName(tagName);
                        return tagRepository.save(t);
                    });
                    item.getTags().add(tag);
                }
            }
            itemRepository.save(item);
            count++;
        }
        return count;
    }

    @Transactional
    public InlayItemDto moveItem(String id, String categoryId) {
        InlayItemEntity item = itemRepository.findById(id)
                .orElseThrow(() -> new BusinessException(404, "镶嵌结构不存在: " + id));
        item.setCategoryId(categoryId);
        return toDto(itemRepository.save(item));
    }

    @Transactional
    public void deleteItem(String id) {
        InlayItemEntity item = itemRepository.findById(id)
                .orElseThrow(() -> new BusinessException(404, "镶嵌结构不存在: " + id));
        purgeItemStorageAndJobs(item);
        itemRepository.delete(item);
    }

    @Transactional
    public int batchDeleteItems(List<String> ids) {
        if (ids == null || ids.isEmpty()) return 0;
        int count = 0;
        for (String id : ids) {
            InlayItemEntity item = itemRepository.findById(id).orElse(null);
            if (item == null) continue;
            purgeItemStorageAndJobs(item);
            itemRepository.delete(item);
            count++;
        }
        return count;
    }

    private void purgeItemStorageAndJobs(InlayItemEntity item) {
        for (InlayAssetEntity asset : assetRepository.findByInlayId(item.getId())) {
            storageService.deleteObject(asset.getStorageBucket(), asset.getStorageKey());
        }
        previewJobRepository.deleteByInlayId(item.getId());
    }

    public Optional<AssetStream> getThumbnail(String id) {
        return getAssetStream(id, List.of("thumb_webp", "preview_png", "preview_hd"));
    }

    public Optional<AssetStream> getSourceJcd(String id) {
        return getAssetStream(id, List.of("source_jcd"), false);
    }

    public InlayItemDto toDtoPublic(InlayItemEntity item) {
        return toDto(item);
    }

    public Optional<AssetStream> getMesh(String id, boolean preferGlb) {
        InlayItemEntity item = itemRepository.findById(id).orElse(null);
        if (item != null && item.isMeshIsProxy()) {
            return Optional.empty();
        }
        if (preferGlb) {
            Optional<AssetStream> glb = getAssetStream(id, List.of("mesh_glb"), false);
            if (glb.isPresent()) return glb;
        }
        return getAssetStream(id, List.of("mesh_obj", "mesh_glb", "mesh_stl"), true);
    }

    @Transactional
    public InlayItemDto syncMeshFromDisk(String id) {
        InlayItemEntity item = itemRepository.findByIdWithTags(id)
                .orElseThrow(() -> new BusinessException(404, "镶嵌结构不存在: " + id));
        rehydrateService.syncMeshFromStorage(item);
        return toDto(itemRepository.save(item));
    }

    @Transactional
    public Map<String, Object> syncAllMeshFromLegacy() {
        int updated = 0;
        int realMesh = 0;
        int proxyMesh = 0;
        int noMesh = 0;

        for (InlayItemEntity item : itemRepository.findAll()) {
            rehydrateService.syncMeshFromStorage(item);
            itemRepository.save(item);
            updated++;
            if (item.isMeshReady()) {
                realMesh++;
            } else if (item.isMeshIsProxy()) {
                proxyMesh++;
            } else {
                noMesh++;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("updated", updated);
        result.put("real_mesh", realMesh);
        result.put("proxy_mesh", proxyMesh);
        result.put("no_mesh", noMesh);
        result.put("source", "storage");
        return result;
    }

    private Optional<AssetStream> getAssetStream(String id, List<String> assetTypes) {
        return getAssetStream(id, assetTypes, true);
    }

    private Optional<AssetStream> getAssetStream(String id, List<String> assetTypes, boolean rejectProxy) {
        InlayItemEntity item = itemRepository.findById(id).orElse(null);
        if (item == null) return Optional.empty();

        for (String type : assetTypes) {
            Optional<InlayAssetEntity> assetOpt = assetRepository.findByInlayIdAndAssetTypeAndCurrentTrue(id, type);
            if (assetOpt.isEmpty()) continue;
            InlayAssetEntity asset = assetOpt.get();

            if (asset.getStorageKey().startsWith("legacy:")) {
                if (!v2Config.isLegacyFallback()) {
                    continue;
                }
                Path legacyPath = resolveLegacyFile(item.getLegacyPath(), type);
                if (legacyPath != null && Files.isRegularFile(legacyPath)) {
                    if (rejectProxy && type.startsWith("mesh") && InlayMeshMetadataUtil.isKnownProxyObj(legacyPath)) {
                        continue;
                    }
                    try {
                        return Optional.of(new AssetStream(
                                Files.newInputStream(legacyPath),
                                probeContentType(legacyPath),
                                legacyPath.getFileName().toString(),
                                Files.size(legacyPath)
                        ));
                    } catch (Exception e) {
                        log.debug("Legacy file read failed: {}", legacyPath);
                    }
                }
                continue;
            }

            Optional<Path> local = storageService.resolveLocalPath(asset.getStorageBucket(), asset.getStorageKey());
            if (local.isPresent()) {
                if (rejectProxy && type.startsWith("mesh") && InlayMeshMetadataUtil.isKnownProxyObj(local.get())) {
                    continue;
                }
                try {
                    return Optional.of(new AssetStream(
                            Files.newInputStream(local.get()),
                            probeContentType(local.get()),
                            local.get().getFileName().toString(),
                            Files.size(local.get())
                    ));
                } catch (Exception e) {
                    log.debug("Local storage read failed");
                }
            }

            Optional<InputStream> stream = storageService.getObject(asset.getStorageBucket(), asset.getStorageKey());
            if (stream.isPresent()) {
                return Optional.of(new AssetStream(stream.get(), "application/octet-stream",
                        asset.getStorageKey(), asset.getSizeBytes() != null ? asset.getSizeBytes() : -1));
            }
        }

        if (v2Config.isLegacyFallback()) {
            return resolveLegacyPreviewOrMesh(item, assetTypes, rejectProxy);
        }
        return Optional.empty();
    }

    private Optional<AssetStream> resolveLegacyPreviewOrMesh(
            InlayItemEntity item, List<String> assetTypes, boolean rejectProxy
    ) {
        if (item.getLegacyPath() == null) return Optional.empty();
        Path dbRoot = Paths.get(inlayDbConfig.getPath()).toAbsolutePath().normalize();
        Path source = dbRoot.resolve(item.getLegacyPath().replace("/", dbRoot.getFileSystem().getSeparator()));
        if (!Files.isRegularFile(source)) return Optional.empty();

        Path parent = source.getParent();
        String baseName = getBaseName(source.getFileName().toString());

        if (assetTypes.stream().anyMatch(t -> t.contains("thumb") || t.contains("preview"))) {
            for (String ext : List.of(".png", ".webp", ".jpg", ".bmp")) {
                Path p = parent.resolve(baseName + ext);
                if (Files.isRegularFile(p)) {
                    try {
                        return Optional.of(new AssetStream(Files.newInputStream(p), probeContentType(p),
                                p.getFileName().toString(), Files.size(p)));
                    } catch (Exception e) {
                        return Optional.empty();
                    }
                }
            }
        }

        if (assetTypes.stream().anyMatch(t -> t.startsWith("mesh"))) {
            for (String ext : List.of(".glb", ".obj", ".stl")) {
                Path p = parent.resolve(baseName + ext);
                if (Files.isRegularFile(p)) {
                    if (rejectProxy && InlayMeshMetadataUtil.isKnownProxyObj(p)) {
                        continue;
                    }
                    try {
                        return Optional.of(new AssetStream(Files.newInputStream(p), probeContentType(p),
                                p.getFileName().toString(), Files.size(p)));
                    } catch (Exception e) {
                        return Optional.empty();
                    }
                }
            }
        }
        return Optional.empty();
    }

    private Path resolveLegacyFile(String legacyPath, String assetType) {
        Path dbRoot = Paths.get(inlayDbConfig.getPath()).toAbsolutePath().normalize();
        Path source = dbRoot.resolve(legacyPath.replace("/", dbRoot.getFileSystem().getSeparator()));
        if (!Files.isRegularFile(source)) return null;
        if (assetType.contains("thumb") || assetType.contains("preview")) {
            Path parent = source.getParent();
            String base = getBaseName(source.getFileName().toString());
            for (String ext : List.of(".png", ".webp", ".jpg", ".bmp")) {
                Path p = parent.resolve(base + ext);
                if (Files.isRegularFile(p)) return p;
            }
        }
        return source;
    }

    public void enqueuePreviewRegeneration(String id) {
        previewJobService.enqueue(id, "preview", 10);
    }

    public void enqueueMeshConversion(String id) {
        previewJobService.enqueue(id, "mesh", 5);
    }

    public InlayStatsDto getStats() {
        return InlayStatsDto.builder()
                .total(itemRepository.count())
                .meshReady(itemRepository.countByMeshReadyTrue())
                .hasPreview(itemRepository.countByHasPreviewTrue())
                .byStatus(Map.of("active", itemRepository.countByStatus("active")))
                .build();
    }

    public List<InlayCategoryNode> getCategoryTree() {
        List<CategoryEntity> roots = categoryRepository.findByParentIdIsNullOrderBySortOrderAscNameAsc();
        if (roots.isEmpty()) {
            return buildPathBasedCategoryTree();
        }
        return roots.stream().map(this::toCategoryNode).toList();
    }

    private List<InlayCategoryNode> buildPathBasedCategoryTree() {
        Map<String, MutableCat> root = new LinkedHashMap<>();
        itemRepository.findAll().forEach(item -> {
            if (item.getLegacyPath() == null) return;
            String[] parts = item.getLegacyPath().split("/");
            MutableCat current = null;
            StringBuilder prefix = new StringBuilder();
            for (int i = 0; i < parts.length - 1; i++) {
                if (i > 0) prefix.append('/');
                prefix.append(parts[i]);
                String segment = parts[i];
                String key = prefix.toString();
                if (current == null) {
                    current = root.computeIfAbsent(key, k -> new MutableCat(segment, key));
                } else {
                    current = current.children.computeIfAbsent(key, k -> new MutableCat(segment, key));
                }
                current.count++;
            }
        });
        return root.values().stream().map(MutableCat::toDto).toList();
    }

    public List<TagEntity> listTags() {
        return tagRepository.findAll(Sort.by("name"));
    }

    @Transactional
    public TagEntity createTag(String name, String color) {
        return tagRepository.findByName(name).orElseGet(() -> {
            TagEntity tag = new TagEntity();
            tag.setId(UUID.randomUUID().toString());
            tag.setName(name);
            tag.setColor(color);
            return tagRepository.save(tag);
        });
    }

    @Transactional
    public CategoryEntity createCategory(String name, String parentId) {
        CategoryEntity cat = new CategoryEntity();
        cat.setId(UUID.randomUUID().toString());
        cat.setName(name);
        cat.setSlug(slugify(name));
        cat.setParentId(parentId);
        return categoryRepository.save(cat);
    }

    private Specification<InlayItemEntity> buildSpec(InlayItemQueryDto q) {
        return (root, cq, cb) -> {
            List<Predicate> preds = new ArrayList<>();
            if (q.getQ() != null && !q.getQ().isBlank()) {
                String kw = "%" + q.getQ().trim().toLowerCase() + "%";
                preds.add(cb.or(
                        cb.like(cb.lower(root.get("displayName")), kw),
                        cb.like(cb.lower(root.get("legacyPath")), kw)
                ));
            }
            if (q.getCategoryId() != null && !q.getCategoryId().isBlank()) {
                preds.add(cb.equal(root.get("categoryId"), q.getCategoryId()));
            }
            if (q.getMeshReady() != null) {
                preds.add(cb.equal(root.get("meshReady"), q.getMeshReady()));
            }
            if (q.getHasPreview() != null) {
                preds.add(cb.equal(root.get("hasPreview"), q.getHasPreview()));
            }
            if (q.getPreviewMethod() != null && !q.getPreviewMethod().isBlank()) {
                preds.add(cb.equal(root.get("previewMethod"), q.getPreviewMethod()));
            }
            if (q.getInlayType() != null && !q.getInlayType().isBlank()) {
                preds.add(cb.equal(root.get("inlayType"), q.getInlayType()));
            }
            if (q.getStatus() != null && !q.getStatus().isBlank()) {
                preds.add(cb.equal(root.get("status"), q.getStatus()));
            } else {
                preds.add(cb.equal(root.get("status"), "active"));
            }
            if (q.getStoneDiameterMin() != null) {
                preds.add(cb.greaterThanOrEqualTo(root.get("stoneDiameterMm"), q.getStoneDiameterMin()));
            }
            if (q.getStoneDiameterMax() != null) {
                preds.add(cb.lessThanOrEqualTo(root.get("stoneDiameterMm"), q.getStoneDiameterMax()));
            }
            if (q.getTags() != null && !q.getTags().isBlank()) {
                String[] tagNames = q.getTags().split(",");
                Join<InlayItemEntity, TagEntity> tagJoin = root.join("tags");
                for (String tag : tagNames) {
                    preds.add(cb.equal(cb.lower(tagJoin.get("name")), tag.trim().toLowerCase()));
                }
            }
            return cb.and(preds.toArray(new Predicate[0]));
        };
    }

    private Sort parseSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return Sort.by(Sort.Direction.DESC, "updatedAt");
        }
        String[] parts = sort.split(":");
        String field = switch (parts[0]) {
            case "name" -> "displayName";
            case "quality" -> "previewQuality";
            case "updated_at" -> "updatedAt";
            default -> parts[0];
        };
        Sort.Direction dir = parts.length > 1 && "asc".equalsIgnoreCase(parts[1])
                ? Sort.Direction.ASC : Sort.Direction.DESC;
        return Sort.by(dir, field);
    }

    private Map<String, Long> buildStats() {
        Map<String, Long> stats = new LinkedHashMap<>();
        stats.put("total", itemRepository.count());
        stats.put("mesh_ready", itemRepository.countByMeshReadyTrue());
        stats.put("mesh_proxy", itemRepository.countByMeshIsProxyTrue());
        stats.put("has_preview", itemRepository.countByHasPreviewTrue());
        return stats;
    }

    private InlayItemDto toDto(InlayItemEntity item) {
        InlayItemDto.CategoryBrief cat = null;
        if (item.getCategoryId() != null) {
            cat = categoryRepository.findById(item.getCategoryId())
                    .map(c -> InlayItemDto.CategoryBrief.builder().id(c.getId()).name(c.getName()).build())
                    .orElse(null);
        }

        Long fileSize = assetRepository.findByInlayIdAndCurrentTrue(item.getId()).stream()
                .map(InlayAssetEntity::getSizeBytes)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);

        return InlayItemDto.builder()
                .id(item.getId())
                .displayName(item.getDisplayName())
                .legacyPath(item.getLegacyPath())
                .primaryFormat(item.getPrimaryFormat())
                .meshReady(item.isMeshReady())
                .meshMethod(item.getMeshMethod())
                .meshIsProxy(item.isMeshIsProxy())
                .hasPreview(item.isHasPreview())
                .previewQuality(item.getPreviewQuality())
                .previewMethod(item.getPreviewMethod())
                .stoneDiameterMm(item.getStoneDiameterMm())
                .inlayType(item.getInlayType())
                .status(item.getStatus())
                .tags(item.getTags().stream().map(TagEntity::getName).sorted().toList())
                .category(cat)
                .thumbnailUrl("/api/inlay/v2/items/" + item.getId() + "/thumbnail")
                .meshUrl("/api/inlay/v2/items/" + item.getId() + "/mesh")
                .meshGlbUrl("/api/inlay/v2/items/" + item.getId() + "/mesh/glb")
                .fileSizeBytes(fileSize)
                .updatedAt(item.getUpdatedAt() != null ? item.getUpdatedAt().format(DT_FMT) : null)
                .build();
    }

    private InlayCategoryNode toCategoryNode(CategoryEntity cat) {
        InlayCategoryNode node = new InlayCategoryNode();
        node.setLabel(cat.getName());
        node.setValue(cat.getId());
        List<CategoryEntity> children = categoryRepository.findByParentIdOrderBySortOrderAscNameAsc(cat.getId());
        if (!children.isEmpty()) {
            node.setChildren(children.stream().map(this::toCategoryNode).toList());
        }
        return node;
    }

    private static String slugify(String name) {
        return name.toLowerCase().replaceAll("[^a-z0-9\\u4e00-\\u9fa5]+", "-");
    }

    private static String getBaseName(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(0, dot) : filename;
    }

    private static String probeContentType(Path path) {
        try {
            String ct = Files.probeContentType(path);
            return ct != null ? ct : "application/octet-stream";
        } catch (Exception e) {
            return "application/octet-stream";
        }
    }

    public record AssetStream(InputStream stream, String contentType, String filename, long size) {}

    private static final class MutableCat {
        final String label;
        final String value;
        long count;
        final Map<String, MutableCat> children = new LinkedHashMap<>();

        MutableCat(String label, String value) {
            this.label = label;
            this.value = value;
        }

        InlayCategoryNode toDto() {
            InlayCategoryNode dto = new InlayCategoryNode();
            dto.setLabel(label + " (" + count + ")");
            dto.setValue(value);
            dto.setCount(count);
            if (!children.isEmpty()) {
                dto.setChildren(children.values().stream().map(MutableCat::toDto).toList());
            }
            return dto;
        }
    }
}
