package com.jewelry.system.controller;

import com.jewelry.system.dto.order.FileInfoDto;
import com.jewelry.system.dto.portal.*;
import com.jewelry.system.entity.PortalJewelryCategory;
import com.jewelry.system.entity.PortalSiteSettings;
import com.jewelry.system.service.PortalAdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/admin/portal")
@RequiredArgsConstructor
@Tag(name = "管理员门户展示", description = "B 端门户站点与橱窗配置")
public class PortalAdminController {

    private final PortalAdminService portalAdminService;

    @GetMapping("/site-settings")
    @Operation(summary = "读取门户站点配置（含轮播/企业图文件 ID 列表）")
    public PortalSiteSettingsAdminDto getSiteSettings() {
        return portalAdminService.getSiteSettingsAdminDto();
    }

    @PutMapping("/site-settings")
    @Operation(summary = "更新门户站点配置")
    public PortalSiteSettings updateSiteSettings(@Valid @RequestBody PortalSiteSettingsUpdateRequest body) {
        return portalAdminService.updateSiteSettings(body);
    }

    @PostMapping(value = "/uploads", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "上传轮播或企业实拍图（kind=carousel|company）")
    public FileInfoDto upload(@RequestPart("file") MultipartFile file, @RequestParam String kind) throws IOException {
        return portalAdminService.uploadPortalMultipart(file, kind);
    }

    @GetMapping("/categories")
    public List<PortalJewelryCategory> listCategories() {
        return portalAdminService.listCategoriesAdmin();
    }

    @PostMapping("/categories")
    public PortalJewelryCategory createCategory(@RequestBody PortalJewelryCategoryRequest body) {
        return portalAdminService.createCategory(body);
    }

    @PutMapping("/categories/{id}")
    public PortalJewelryCategory updateCategory(@PathVariable long id, @RequestBody PortalJewelryCategoryRequest body) {
        return portalAdminService.updateCategory(id, body);
    }

    @DeleteMapping("/categories/{id}")
    public void deleteCategory(@PathVariable long id) {
        portalAdminService.deleteCategory(id);
    }

    @GetMapping("/orders/{orderId}/showcase-candidates")
    public List<FileInfoDto> showcaseCandidates(@PathVariable long orderId) {
        return portalAdminService.listShowcaseCandidates(orderId);
    }

    @PostMapping("/showcase-items")
    public PortalShowcaseItemAdminDto addShowcase(@Valid @RequestBody PortalShowcaseItemAddRequest body) {
        return portalAdminService.addShowcaseItem(body);
    }

    @DeleteMapping("/showcase-items/{id}")
    public void deleteShowcase(@PathVariable long id) {
        portalAdminService.deleteShowcaseItem(id);
    }

    @GetMapping("/categories/{categoryId}/showcase-items")
    public List<PortalShowcaseItemAdminDto> listShowcase(@PathVariable long categoryId) {
        return portalAdminService.listShowcaseItemsForCategory(categoryId);
    }

    @PutMapping("/categories/{categoryId}/showcase-reorder")
    public void reorder(@PathVariable long categoryId, @Valid @RequestBody PortalShowcaseReorderRequest body) {
        portalAdminService.reorderShowcase(categoryId, body);
    }
}
