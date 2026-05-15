package com.jewelry.system.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.portal.*;
import com.jewelry.system.entity.FileEntity;
import com.jewelry.system.entity.PortalJewelryCategory;
import com.jewelry.system.entity.PortalShowcaseItem;
import com.jewelry.system.entity.PortalSiteSettings;
import com.jewelry.system.repository.FileEntityRepository;
import com.jewelry.system.repository.PortalJewelryCategoryRepository;
import com.jewelry.system.repository.PortalShowcaseItemRepository;
import com.jewelry.system.repository.PortalSiteSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PortalPublicService {

    private final PortalSiteSettingsRepository portalSiteSettingsRepository;
    private final PortalJewelryCategoryRepository portalJewelryCategoryRepository;
    private final PortalShowcaseItemRepository portalShowcaseItemRepository;
    private final FileEntityRepository fileEntityRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public PortalHomePublicDto home() {
        PortalSiteSettings s = portalSiteSettingsRepository.findById(PortalSiteSettings.SINGLETON_ID)
                .orElseGet(PortalSiteSettings::new);
        List<PortalJewelryCategory> cats = portalJewelryCategoryRepository.findAllByEnabledTrueOrderBySortOrderAscIdAsc();
        List<PortalCategoryPublicDto> categoryDtos = new ArrayList<>();
        for (PortalJewelryCategory c : cats) {
            List<PortalShowcaseItem> items = portalShowcaseItemRepository
                    .findByCategoryAndPublishedTrueOrderBySortOrderAscIdAsc(c);
            List<PortalImageDto> previews = items.stream()
                    .limit(6)
                    .map(i -> toImg(i.getFile(), i.getCaption()))
                    .collect(Collectors.toList());
            String cover = previews.isEmpty() ? null : previews.get(0).getUrl();
            categoryDtos.add(PortalCategoryPublicDto.builder()
                    .slug(c.getSlug())
                    .nameCn(c.getNameCn())
                    .nameEn(c.getNameEn())
                    .description(c.getDescription())
                    .coverUrl(cover)
                    .visibleItemCount(items.size())
                    .preview(previews)
                    .build());
        }
        return PortalHomePublicDto.builder()
                .heroTitle(s.getHeroTitle())
                .heroSubtitle(s.getHeroSubtitle())
                .aboutHtml(s.getAboutHtml())
                .businessHours(s.getBusinessHours())
                .contactPhone(s.getContactPhone())
                .contactWechat(s.getContactWechat())
                .contactEmail(s.getContactEmail())
                .address(s.getAddress())
                .carousel(resolveOrderedFiles(s.getCarouselFileIdsJson()))
                .companyPhotos(resolveOrderedFiles(s.getCompanyPhotoFileIdsJson()))
                .categories(categoryDtos)
                .build();
    }

    @Transactional(readOnly = true)
    public PortalCategoryDetailPublicDto categoryDetail(String slug) {
        PortalJewelryCategory c = portalJewelryCategoryRepository.findBySlug(slug)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "分类不存在"));
        if (!c.isEnabled()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "分类未启用");
        }
        List<PortalShowcaseItem> items = portalShowcaseItemRepository
                .findByCategoryAndPublishedTrueOrderBySortOrderAscIdAsc(c);
        List<PortalImageDto> imgs = items.stream().map(i -> toImg(i.getFile(), i.getCaption())).toList();
        return PortalCategoryDetailPublicDto.builder()
                .slug(c.getSlug())
                .nameCn(c.getNameCn())
                .nameEn(c.getNameEn())
                .description(c.getDescription())
                .items(imgs)
                .build();
    }

    private PortalImageDto toImg(FileEntity f, String caption) {
        return PortalImageDto.builder()
                .fileId(f.getId())
                .url(f.getFileUrl())
                .caption(caption)
                .build();
    }

    private List<PortalImageDto> resolveOrderedFiles(String json) {
        List<Long> ids = readIdList(json);
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<Long, FileEntity> map = fileEntityRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(FileEntity::getId, fe -> fe, (a, b) -> a, LinkedHashMap::new));
        List<PortalImageDto> out = new ArrayList<>();
        for (Long id : ids) {
            FileEntity fe = map.get(id);
            if (fe != null && fe.getFileUrl() != null && !fe.getFileUrl().isBlank()) {
                out.add(toImg(fe, null));
            }
        }
        return out;
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
}
