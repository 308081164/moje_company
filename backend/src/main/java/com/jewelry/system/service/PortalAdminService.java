package com.jewelry.system.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.order.FileInfoDto;
import com.jewelry.system.dto.portal.*;
import com.jewelry.system.entity.FileEntity;
import com.jewelry.system.entity.PortalHomeBlock;
import com.jewelry.system.entity.PortalJewelryCategory;
import com.jewelry.system.entity.PortalShowcaseItem;
import com.jewelry.system.entity.PortalSiteSettings;
import com.jewelry.system.enums.FileRelatedType;
import com.jewelry.system.repository.FileEntityRepository;
import com.jewelry.system.repository.PortalJewelryCategoryRepository;
import com.jewelry.system.repository.PortalShowcaseItemRepository;
import com.jewelry.system.repository.PortalSiteSettingsRepository;
import com.jewelry.system.repository.PortalHomeBlockRepository;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class PortalAdminService {

    private static final List<String> SHOWCASE_FILE_TYPES = List.of("DESIGN", "MODEL_EFFECT");

    private final PortalSiteSettingsRepository portalSiteSettingsRepository;
    private final PortalJewelryCategoryRepository portalJewelryCategoryRepository;
    private final PortalShowcaseItemRepository portalShowcaseItemRepository;
    private final PortalHomeBlockRepository homeBlockRepository;
    private final FileEntityRepository fileEntityRepository;
    private final OrderRepository orderRepository;
    private final OrderFileService orderFileService;
    private final HomeContentTranslationService translationService;
    private final ObjectMapper objectMapper;

    private void assertAdmin() {
        if (!"ADMIN".equals(SecurityUtils.currentRoleApi().orElse(null))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可操作门户展示配置");
        }
    }

    @Transactional
    public PortalSiteSettings updateSiteSettings(String scope, PortalSiteSettingsUpdateRequest req) {
        assertAdmin();
        PortalSiteSettings s = requireSiteSettings(scope);
        if (req.getHeroTitle() != null) {
            s.setHeroTitle(req.getHeroTitle());
        }
        if (req.getHeroSubtitle() != null) {
            s.setHeroSubtitle(req.getHeroSubtitle());
        }
        if (req.getAboutHtml() != null) {
            s.setAboutHtml(req.getAboutHtml());
        }
        if (req.getBusinessHours() != null) {
            s.setBusinessHours(req.getBusinessHours());
        }
        if (req.getContactPhone() != null) {
            s.setContactPhone(req.getContactPhone());
        }
        if (req.getContactWechat() != null) {
            s.setContactWechat(req.getContactWechat());
        }
        if (req.getContactEmail() != null) {
            s.setContactEmail(req.getContactEmail());
        }
        if (req.getAddress() != null) {
            s.setAddress(req.getAddress());
        }
        if (req.getCarouselFileIds() != null) {
            s.setCarouselFileIdsJson(writeIds(req.getCarouselFileIds()));
        }
        if (req.getCompanyPhotoFileIds() != null) {
            s.setCompanyPhotoFileIdsJson(writeIds(req.getCompanyPhotoFileIds()));
        }
        return portalSiteSettingsRepository.save(s);
    }

    private String writeIds(List<Long> ids) {
        try {
            return objectMapper.writeValueAsString(ids == null ? List.of() : ids);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "文件 ID 列表序列化失败");
        }
    }

    @Transactional(readOnly = true)
    public List<PortalJewelryCategory> listCategoriesAdmin(String scope) {
        assertAdmin();
        return portalJewelryCategoryRepository.findByScopeOrderBySortOrderAscIdAsc(scope).stream()
                .sorted((a, b) -> {
                    int c = Integer.compare(a.getSortOrder(), b.getSortOrder());
                    return c != 0 ? c : Long.compare(a.getId(), b.getId());
                })
                .toList();
    }

    @Transactional
    public PortalJewelryCategory createCategory(String scope, PortalJewelryCategoryRequest req) {
        assertAdmin();
        if (req.getSlug() == null || req.getSlug().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "slug 不能为空");
        }
        String slug = normalizeSlug(req.getSlug());
        if (portalJewelryCategoryRepository.findBySlug(slug).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "slug 已存在");
        }
        PortalJewelryCategory c = new PortalJewelryCategory();
        c.setScope(scope);
        c.setSlug(slug);
        c.setNameCn(req.getNameCn() != null ? req.getNameCn() : slug);
        c.setNameEn(req.getNameEn());
        c.setDescription(req.getDescription());
        c.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : 0);
        c.setEnabled(req.getEnabled() == null || req.getEnabled());
        return portalJewelryCategoryRepository.save(c);
    }

    @Transactional
    public PortalJewelryCategory updateCategory(long id, PortalJewelryCategoryRequest req) {
        assertAdmin();
        PortalJewelryCategory c = portalJewelryCategoryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "分类不存在"));
        if (req.getSlug() != null && !req.getSlug().isBlank()) {
            String slug = normalizeSlug(req.getSlug());
            portalJewelryCategoryRepository.findBySlug(slug).filter(other -> !other.getId().equals(c.getId()))
                    .ifPresent(x -> {
                        throw new ResponseStatusException(HttpStatus.CONFLICT, "slug 已被使用");
                    });
            c.setSlug(slug);
        }
        if (req.getNameCn() != null) {
            c.setNameCn(req.getNameCn());
        }
        if (req.getNameEn() != null) {
            c.setNameEn(req.getNameEn());
        }
        if (req.getDescription() != null) {
            c.setDescription(req.getDescription());
        }
        if (req.getSortOrder() != null) {
            c.setSortOrder(req.getSortOrder());
        }
        if (req.getEnabled() != null) {
            c.setEnabled(req.getEnabled());
        }
        return portalJewelryCategoryRepository.save(c);
    }

    @Transactional
    public void deleteCategory(long id) {
        assertAdmin();
        portalJewelryCategoryRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public List<FileInfoDto> listShowcaseCandidates(long orderId) {
        assertAdmin();
        orderRepository.findById(orderId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
        List<FileEntity> list = fileEntityRepository.findByRelatedTypeAndRelatedIdAndFileTypeInOrderByIdDesc(
                FileRelatedType.ORDER, orderId, SHOWCASE_FILE_TYPES);
        return list.stream().filter(this::isRasterLike).map(orderFileService::toFileInfoDto).toList();
    }

    private boolean isRasterLike(FileEntity f) {
        String ext = f.getFileExtension();
        if (ext == null || ext.isBlank()) {
            return true;
        }
        String e = ext.toLowerCase(Locale.ROOT);
        return Set.of("jpg", "jpeg", "png", "gif", "webp", "bmp").contains(e);
    }

    @Transactional
    public PortalShowcaseItemAdminDto addShowcaseItem(PortalShowcaseItemAddRequest req) {
        assertAdmin();
        PortalJewelryCategory cat = portalJewelryCategoryRepository.findById(req.getCategoryId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "分类不存在"));
        FileEntity file = fileEntityRepository.findById(req.getFileId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "文件不存在"));
        if (file.getRelatedType() != FileRelatedType.ORDER || file.getRelatedId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "仅可选择订单内的设计图或建模预览图文件");
        }
        if (!SHOWCASE_FILE_TYPES.contains(file.getFileType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "仅支持设计图(DESIGN)或建模效果图(MODEL_EFFECT)");
        }
        if (portalShowcaseItemRepository.existsByCategory_IdAndFile_Id(cat.getId(), file.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该图已在该分类下");
        }
        PortalShowcaseItem row = new PortalShowcaseItem();
        row.setCategory(cat);
        row.setFile(file);
        row.setCaption(req.getCaption());
        row.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : 0);
        row.setPublished(true);
        PortalShowcaseItem saved = portalShowcaseItemRepository.save(row);
        return toShowcaseAdminDto(saved);
    }

    @Transactional
    public void deleteShowcaseItem(long itemId) {
        assertAdmin();
        portalShowcaseItemRepository.deleteById(itemId);
    }

    @Transactional
    public void reorderShowcase(long categoryId, PortalShowcaseReorderRequest req) {
        assertAdmin();
        PortalJewelryCategory cat = portalJewelryCategoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "分类不存在"));
        List<Long> ids = req.getItemIdsInOrder();
        int pos = 0;
        for (Long id : ids) {
            PortalShowcaseItem it = portalShowcaseItemRepository.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "橱窗项不存在: " + id));
            if (!it.getCategory().getId().equals(cat.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "橱窗项不属于该分类");
            }
            it.setSortOrder(pos++);
            portalShowcaseItemRepository.save(it);
        }
    }

    public FileInfoDto uploadPortalMultipart(MultipartFile file, String kind) throws IOException {
        assertAdmin();
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "文件不能为空");
        }
        String k = kind != null ? kind.toLowerCase(Locale.ROOT) : "misc";
        if ("carousel".equals(k)) {
            return orderFileService.uploadPortalPublicFile(file, "carousel", "PORTAL_CAROUSEL");
        }
        if ("company".equals(k)) {
            return orderFileService.uploadPortalPublicFile(file, "company", "PORTAL_COMPANY");
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "kind 须为 carousel 或 company");
    }

    @Transactional(readOnly = true)
    public PortalSiteSettingsAdminDto getSiteSettingsAdminDto(String scope) {
        assertAdmin();
        PortalSiteSettings s = requireSiteSettings(scope);
        return PortalSiteSettingsAdminDto.builder()
                .heroTitle(s.getHeroTitle())
                .heroSubtitle(s.getHeroSubtitle())
                .aboutHtml(s.getAboutHtml())
                .businessHours(s.getBusinessHours())
                .contactPhone(s.getContactPhone())
                .contactWechat(s.getContactWechat())
                .contactEmail(s.getContactEmail())
                .address(s.getAddress())
                .carouselFileIds(readIdList(s.getCarouselFileIdsJson()))
                .companyPhotoFileIds(readIdList(s.getCompanyPhotoFileIdsJson()))
                .build();
    }

    @Transactional(readOnly = true)
    public List<PortalShowcaseItemAdminDto> listShowcaseItemsForCategory(long categoryId) {
        assertAdmin();
        portalJewelryCategoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "分类不存在"));
        return portalShowcaseItemRepository.findByCategory_IdOrderBySortOrderAscIdAsc(categoryId).stream()
                .map(this::toShowcaseAdminDto)
                .toList();
    }

    private PortalShowcaseItemAdminDto toShowcaseAdminDto(PortalShowcaseItem it) {
        FileEntity f = it.getFile();
        return PortalShowcaseItemAdminDto.builder()
                .id(it.getId())
                .categoryId(it.getCategory().getId())
                .categorySlug(it.getCategory().getSlug())
                .fileId(f.getId())
                .fileUrl(f.getFileUrl())
                .fileName(f.getFileName())
                .fileType(f.getFileType())
                .caption(it.getCaption())
                .sortOrder(it.getSortOrder())
                .build();
    }

    private List<Long> readIdList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            List<Long> list = objectMapper.readValue(json, new TypeReference<List<Long>>() {
            });
            return list == null ? List.of() : list.stream().filter(v -> v != null && v > 0).toList();
        } catch (Exception e) {
            return List.of();
        }
    }

    // ---------- 首页区块（所见即所得配置） ----------

    @Transactional(readOnly = true)
    public List<HomeBlockDto> listHomeBlocks(String scope) {
        assertAdmin();
        return homeBlockRepository.findByScopeOrderBySectionAscSortOrderAscIdAsc(scope).stream()
                .map(this::toHomeBlockDto)
                .toList();
    }

    @Transactional
    public List<HomeBlockDto> upsertHomeBlocks(String scope, List<HomeBlockUpsertRequest> blocks) {
        assertAdmin();
        if (blocks == null || blocks.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "区块列表不能为空");
        }
        for (HomeBlockUpsertRequest req : blocks) {
            if (!StringUtils.hasText(req.getSection()) || !StringUtils.hasText(req.getBlockKey())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "section 与 blockKey 不能为空");
            }
            PortalHomeBlock block;
            if (req.getId() != null) {
                block = homeBlockRepository.findById(req.getId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "区块不存在: " + req.getId()));
                block.setScope(scope);
            } else {
                block = new PortalHomeBlock();
                block.setScope(scope);
            }
            block.setSection(req.getSection().trim());
            block.setBlockKey(req.getBlockKey().trim());
            if (req.getSortOrder() != null) {
                block.setSortOrder(req.getSortOrder());
            }
            if (req.getEnabled() != null) {
                block.setEnabled(req.getEnabled());
            }
            block.setContentJson(writeContent(req.getContent()));
            homeBlockRepository.save(block);
        }
        return listHomeBlocks(scope);
    }

    public Map<String, String> translateHomeBlockText(String zhText) {
        assertAdmin();
        if (!StringUtils.hasText(zhText)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "中文原文不能为空");
        }
        return translationService.translate(zhText.trim());
    }

    private PortalSiteSettings requireSiteSettings(String scope) {
        return portalSiteSettingsRepository.findByScope(normalizeScope(scope))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "门户配置未初始化"));
    }

    private static String normalizeScope(String scope) {
        String s = scope == null ? "" : scope.trim().toUpperCase();
        if ("C".equals(s)) {
            return "C";
        }
        return "B";
    }

    private HomeBlockDto toHomeBlockDto(PortalHomeBlock b) {
        return HomeBlockDto.builder()
                .id(b.getId())
                .scope(b.getScope())
                .section(b.getSection())
                .blockKey(b.getBlockKey())
                .sortOrder(b.getSortOrder())
                .enabled(b.isEnabled())
                .content(readContent(b.getContentJson()))
                .build();
    }

    private String writeContent(Map<String, Object> content) {
        if (content == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(content);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "区块内容序列化失败");
        }
    }

    private Map<String, Object> readContent(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return null;
        }
    }

    private static String normalizeSlug(String raw) {
        String s = raw.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9\\-]+", "-");
        if (s.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "slug 不合法");
        }
        return s;
    }
}
