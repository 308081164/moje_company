package com.jewelry.system.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.jewelry.system.service.InlayDbClient;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 镶嵌结构库代理：转发到独立项目 AI_3d_DataBase（8871）。
 * 仅暴露接口能力，UI 由本系统前端重绘。
 */
@RestController
@RequestMapping("/inlay-db")
@RequiredArgsConstructor
@Tag(name = "镶嵌结构库(对接AI数据库)", description = "代理 AI_3d_DataBase 的浏览/上传/识结构/下载能力")
public class InlayDbProxyController {

    private final InlayDbClient client;

    // ---------- 浏览 / 搜索 ----------

    @GetMapping("/items")
    @Operation(summary = "结构条目列表（关键词/标签/大类/尺寸过滤 + 分页）")
    public JsonNode listItems(@RequestParam Map<String, String> params) {
        return client.getData("/inlay/v2/items", params);
    }

    @GetMapping("/items/grouped")
    @Operation(summary = "镶口大类：按 display_name 聚合列表")
    public JsonNode listGroupedItems(@RequestParam Map<String, String> params) {
        return client.getData("/inlay/v2/items/grouped", params);
    }

    @GetMapping("/items/variants-by-name")
    @Operation(summary = "同名结构的全部尺寸变体")
    public JsonNode listVariantsByName(@RequestParam(name = "display_name") String displayName) {
        return client.getData("/inlay/v2/items/variants-by-name", Map.of("display_name", displayName));
    }

    @GetMapping("/items/{id}")
    @Operation(summary = "结构条目详情")
    public JsonNode getItem(@PathVariable String id) {
        return client.getData("/inlay/v2/items/" + id, null);
    }

    @GetMapping("/items/{id}/preview-views")
    @Operation(summary = "条目多视角预览图 URL 列表")
    public JsonNode listPreviewViews(@PathVariable String id) {
        return client.getData("/inlay/v2/items/" + id + "/preview-views", null);
    }

    // ---------- 分类 / 标签 ----------

    @GetMapping("/categories")
    @Operation(summary = "分类树")
    public JsonNode getCategories() {
        return client.getData("/inlay/v2/categories", null);
    }

    @GetMapping("/tags")
    @Operation(summary = "标签列表")
    public JsonNode getTags() {
        return client.getData("/inlay/v2/tags", null);
    }

    @GetMapping("/tags/frequent")
    @Operation(summary = "常用标签")
    public JsonNode getFrequentTags(@RequestParam(defaultValue = "20") int limit) {
        return client.getData("/inlay/v2/tags/frequent", Map.of("limit", String.valueOf(limit)));
    }

    // ---------- 上传 ----------

    @PostMapping(value = "/items", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "上传结构（STEP 必填，JCD/STL/预览可选）")
    public JsonNode createItem(
            @RequestParam(value = "jcd", required = false) MultipartFile jcd,
            @RequestParam(value = "cad", required = false) MultipartFile cad,
            @RequestParam(value = "stl", required = false) MultipartFile stl,
            @RequestParam(value = "source", required = false) MultipartFile source,
            @RequestParam(value = "preview", required = false) MultipartFile preview,
            @RequestParam(value = "mesh", required = false) MultipartFile mesh,
            @RequestParam(value = "display_name", required = false) String displayName,
            @RequestParam(value = "category_id", required = false) String categoryId,
            @RequestParam(value = "tags", required = false) String tags,
            @RequestParam(value = "stone_diameter_mm", required = false) String stoneDiameterMm,
            @RequestParam(value = "inlay_type", required = false) String inlayType
    ) {
        Map<String, MultipartFile> files = new LinkedHashMap<>();
        putFile(files, "jcd", jcd);
        putFile(files, "cad", cad);
        putFile(files, "stl", stl);
        putFile(files, "source", source);
        putFile(files, "preview", preview);
        putFile(files, "mesh", mesh);

        Map<String, String> fields = new LinkedHashMap<>();
        putField(fields, "display_name", displayName);
        putField(fields, "category_id", categoryId);
        putField(fields, "tags", tags);
        putField(fields, "stone_diameter_mm", stoneDiameterMm);
        putField(fields, "inlay_type", inlayType);

        return client.postMultipart("/inlay/v2/items", files, fields);
    }

    @PostMapping("/items/{id}/annotate")
    @Operation(summary = "上传后标注（系统大类 + 关键词 + 重复判定）")
    public JsonNode annotateItem(@PathVariable String id, @RequestBody Map<String, Object> body) {
        return client.postData("/inlay/v2/items/" + id + "/annotate", body);
    }

    @PostMapping(value = "/items/{id}/source-jcd", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "为已有条目补传 JCD")
    public JsonNode uploadSourceJcd(@PathVariable String id, @RequestParam("jcd") MultipartFile jcd) {
        return client.postMultipart("/inlay/v2/items/" + id + "/source-jcd",
                Map.of("jcd", jcd), null);
    }

    // ---------- 下载 / 资源（二进制） ----------

    @GetMapping("/items/{id}/download")
    @Operation(summary = "下载单条多格式（jcd/step/stl）")
    public ResponseEntity<byte[]> downloadItem(@PathVariable String id, @RequestParam String format) {
        InlayDbClient.BinaryResp r = client.getBinary("/inlay/v2/items/" + id + "/download", Map.of("format", format));
        return binaryResponse(r, true);
    }

    @GetMapping("/items/{id}/thumbnail")
    @Operation(summary = "缩略图")
    public ResponseEntity<byte[]> getThumbnail(@PathVariable String id) {
        return binaryResponse(client.getBinary("/inlay/v2/items/" + id + "/thumbnail", null), false);
    }

    @GetMapping("/items/{id}/mesh")
    @Operation(summary = "网格（STL/OBJ）")
    public ResponseEntity<byte[]> getMesh(@PathVariable String id) {
        return binaryResponse(client.getBinary("/inlay/v2/items/" + id + "/mesh", null), false);
    }

    @GetMapping("/items/{id}/mesh/glb")
    @Operation(summary = "网格 GLB")
    public ResponseEntity<byte[]> getMeshGlb(@PathVariable String id) {
        return binaryResponse(client.getBinary("/inlay/v2/items/" + id + "/mesh/glb", null), false);
    }

    @GetMapping("/items/{id}/assets/{assetType}")
    @Operation(summary = "按类型获取资源（preview_view_0..7 等）")
    public ResponseEntity<byte[]> getAssetByType(@PathVariable String id, @PathVariable String assetType) {
        return binaryResponse(client.getBinary("/inlay/v2/items/" + id + "/assets/" + assetType, null), false);
    }

    // ---------- 识结构（视觉检索） ----------

    @PostMapping(value = "/ml/detect-regions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "识结构：自动检测结构区域")
    public JsonNode detectRegions(@RequestParam("image") MultipartFile image) {
        return client.postMultipart("/ml/v1/detect-regions", Map.of("image", image), null);
    }

    @PostMapping(value = "/ml/search-by-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "识结构：整图单大类检索")
    public JsonNode searchByImage(
            @RequestParam("image") MultipartFile image,
            @RequestParam(name = "category_id", required = false) String categoryId,
            @RequestParam(name = "top_k", required = false) String topK
    ) {
        Map<String, String> fields = new LinkedHashMap<>();
        putField(fields, "category_id", categoryId);
        putField(fields, "top_k", topK);
        return client.postMultipart("/ml/v1/search-by-image", Map.of("image", image), fields);
    }

    @PostMapping(value = "/ml/search-by-regions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "识结构：多区域批量检索")
    public JsonNode searchByRegions(
            @RequestParam("image") MultipartFile image,
            @RequestParam("regions") String regionsJson,
            @RequestParam(name = "top_k", required = false) String topK
    ) {
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("regions", regionsJson);
        putField(fields, "top_k", topK);
        return client.postMultipart("/ml/v1/search-by-regions", Map.of("image", image), fields);
    }

    @PostMapping(value = "/ml/preprocess-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "识结构：图像灰度预处理（返回 PNG）")
    public ResponseEntity<byte[]> preprocessImage(@RequestParam("image") MultipartFile image) {
        byte[] body = client.postMultipartBinary("/ml/v1/preprocess-image", Map.of("image", image), null);
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(body);
    }

    @GetMapping("/ml/items/{id}/similar")
    @Operation(summary = "识结构：库内相似结构")
    public JsonNode similarItems(@PathVariable String id, @RequestParam(name = "top_k", required = false) String topK) {
        Map<String, String> params = new LinkedHashMap<>();
        putField(params, "top_k", topK);
        return client.getData("/ml/v1/items/" + id + "/similar", params);
    }

    @GetMapping("/ml/index/status")
    @Operation(summary = "识结构：索引状态")
    public JsonNode indexStatus() {
        return client.getData("/ml/v1/index/status", null);
    }

    // ---------- 工具 ----------

    private void putFile(Map<String, MultipartFile> map, String key, MultipartFile file) {
        if (file != null && !file.isEmpty()) {
            map.put(key, file);
        }
    }

    private void putField(Map<String, String> map, String key, String value) {
        if (value != null && !value.isBlank()) {
            map.put(key, value);
        }
    }

    private ResponseEntity<byte[]> binaryResponse(InlayDbClient.BinaryResp r, boolean attachment) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(r.contentType()));
        if (attachment && r.filename() != null) {
            headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + r.filename() + "\"");
        } else if (r.filename() != null) {
            headers.set(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + r.filename() + "\"");
        }
        return ResponseEntity.ok().headers(headers).body(r.bytes());
    }
}
