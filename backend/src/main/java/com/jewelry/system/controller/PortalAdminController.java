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
import java.util.Map;

@RestController
@RequestMapping("/admin/portal")
@RequiredArgsConstructor
@Tag(name = "管理员门户展示", description = "B/C 端门户站点、首页区块与橱窗配置（所见即所得）")
public class PortalAdminController {

    private final PortalAdminService portalAdminService;

    // ---------- 站点设置 ----------

    @GetMapping("/site-settings")
    @Operation(summary = "读取门户站点配置（scope=B|C）")
    public PortalSiteSettingsAdminDto getSiteSettings(@RequestParam(defaultValue = "B") String scope) {
        return portalAdminService.getSiteSettingsAdminDto(scope);
    }

    @PutMapping("/site-settings")
    @Operation(summary = "更新门户站点配置（scope=B|C）")
    public PortalSiteSettings updateSiteSettings(
            @RequestParam(defaultValue = "B") String scope,
            @Valid @RequestBody PortalSiteSettingsUpdateRequest body) {
        return portalAdminService.updateSiteSettings(scope, body);
    }

    @PostMapping(value = "/uploads", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "上传轮播或企业实拍图（kind=carousel|company）")
    public FileInfoDto upload(@RequestPart("file") MultipartFile file, @RequestParam String kind) throws IOException {
        return portalAdminService.uploadPortalMultipart(file, kind);
    }

    // ---------- 首页区块 ----------

    @GetMapping("/home-blocks")
    @Operation(summary = "读取首页区块配置（scope=B|C）")
    public List<HomeBlockDto> listHomeBlocks(@RequestParam(defaultValue = "B") String scope) {
        return portalAdminService.listHomeBlocks(scope);
    }

    @PutMapping("/home-blocks")
    @Operation(summary = "批量保存首页区块配置（scope=B|C）")
    public List<HomeBlockDto> upsertHomeBlocks(
            @RequestParam(defaultValue = "B") String scope,
            @RequestBody List<HomeBlockUpsertRequest> blocks) {
        return portalAdminService.upsertHomeBlocks(scope, blocks);
    }

    @PostMapping("/home-blocks/translate")
    @Operation(summary = "中文文案 AI 翻译为 8 语言")
    public Map<String, String> translate(@RequestBody HomeBlockTranslateRequest body) {
        return portalAdminService.translateHomeBlockText(body.getZhText());
    }

    // ---------- 分类 / 橱窗 ----------

    @GetMapping("/categories")
    public List<PortalJewelryCategory> listCategories(@RequestParam(defaultValue = "B") String scope) {
        return portalAdminService.listCategoriesAdmin(scope);
    }

    @PostMapping("/categories")
    public PortalJewelryCategory createCategory(
            @RequestParam(defaultValue = "B") String scope,
            @RequestBody PortalJewelryCategoryRequest body) {
        return portalAdminService.createCategory(scope, body);
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
