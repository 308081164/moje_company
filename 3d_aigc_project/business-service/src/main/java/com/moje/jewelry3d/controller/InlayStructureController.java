package com.moje.jewelry3d.controller;

import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.common.Result;
import com.moje.jewelry3d.model.dto.InlayCategoryNode;
import com.moje.jewelry3d.model.dto.InlayPageDto;
import com.moje.jewelry3d.model.dto.InlayQuery;
import com.moje.jewelry3d.model.dto.InlayStructureInfo;
import com.moje.jewelry3d.model.dto.InlayViewDto;
import com.moje.jewelry3d.service.InlayStructureService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 镶嵌结构管理控制器
 * 提供镶嵌结构数据库的查询、预览和上传功能
 */
@Slf4j
@RestController
@RequestMapping("/api/inlay")
public class InlayStructureController {

    private static final byte[] PREVIEW_PLACEHOLDER_SVG = """
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
              <rect width="64" height="64" rx="8" fill="#ecf5ff"/>
              <path d="M20 28 L32 20 L44 28 L44 42 L32 50 L20 42 Z" fill="none" stroke="#409eff" stroke-width="2"/>
              <circle cx="32" cy="32" r="4" fill="#409eff"/>
            </svg>
            """.getBytes(StandardCharsets.UTF_8);

    private final InlayStructureService inlayStructureService;

    @Autowired
    public InlayStructureController(InlayStructureService inlayStructureService) {
        this.inlayStructureService = inlayStructureService;
    }

    /**
     * 列出镶嵌结构（支持关键词、格式、预览状态筛选与分页）
     */
    @GetMapping("/list")
    public Result<InlayPageDto> listStructures(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String format,
            @RequestParam(required = false) String category,
            @RequestParam(name = "has_preview", required = false) Boolean hasPreview,
            @RequestParam(name = "mesh_ready", required = false) Boolean meshReady,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(name = "page_size", defaultValue = "50") int pageSize) {

        InlayQuery query = InlayQuery.builder()
                .keyword(keyword)
                .format(format)
                .category(category)
                .hasPreview(hasPreview)
                .meshReady(meshReady)
                .page(page)
                .pageSize(pageSize)
                .build();

        InlayStructureService.QueryResult result = inlayStructureService.queryStructures(query);

        InlayPageDto pageDto = new InlayPageDto();
        pageDto.setItems(result.items().stream().map(this::toViewDto).collect(Collectors.toList()));
        pageDto.setTotal(result.total());
        pageDto.setPage(result.page());
        pageDto.setPageSize(result.pageSize());
        pageDto.setFormatCounts(result.formatCounts());
        return Result.success(pageDto);
    }

    /**
     * 获取各文件格式数量统计
     */
    @GetMapping("/formats")
    public Result<Map<String, Long>> getFormatStatistics() {
        return Result.success(inlayStructureService.getFormatStatistics());
    }

    /**
     * 获取目录分类树（按文件层级）
     */
    @GetMapping("/categories")
    public Result<List<InlayCategoryNode>> getCategories() {
        return Result.success(inlayStructureService.getCategoryTree());
    }

    /**
     * 刷新镶嵌结构索引（批量导入预览图后调用）
     */
    @PostMapping("/refresh")
    public Result<Map<String, Object>> refreshIndex(
            @RequestParam(name = "async", defaultValue = "false") boolean async) {
        if (async) {
            if (inlayStructureService.isRefreshInProgress()) {
                Map<String, Object> stats = new LinkedHashMap<>();
                stats.put("status", "refreshing");
                return Result.success("索引刷新进行中", stats);
            }
            inlayStructureService.refreshStructureCacheAsync();
            Map<String, Object> stats = new LinkedHashMap<>();
            stats.put("status", "started");
            return Result.success("索引刷新已启动", stats);
        }

        List<InlayStructureInfo> all = inlayStructureService.refreshStructureCache();
        long withPreview = all.stream().filter(InlayStructureInfo::isHasPreview).count();
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("status", "completed");
        stats.put("total", all.size());
        stats.put("with_preview", withPreview);
        stats.put("without_preview", all.size() - withPreview);
        return Result.success("索引已刷新", stats);
    }

    private InlayViewDto toViewDto(InlayStructureInfo info) {
        InlayViewDto dto = new InlayViewDto();
        dto.setId(info.getFilePath());
        dto.setFilename(info.getFilename());
        dto.setFileFormat(info.getFormat());
        dto.setFileSize(info.getFileSize());
        dto.setCreatedAt(info.getLastModified());
        dto.setHasPreview(info.isHasPreview());
        dto.setMeshReady(info.isMeshReady());
        if (info.isHasPreview()) {
            dto.setThumbnailUrl(buildPreviewUrl(info.getFilePath()));
        }
        return dto;
    }

    /**
     * @deprecated 保留兼容，请使用带分页的 /list
     */
    @GetMapping("/list-all")
    public Result<List<InlayViewDto>> listAllStructuresLegacy() {
        List<InlayViewDto> views = inlayStructureService.listAllStructures().stream()
                .map(this::toViewDto)
                .collect(Collectors.toList());
        return Result.success(views);
    }

    /**
     * 获取指定镶嵌结构的详细信息
     *
     * @param filename 文件名
     * @return 镶嵌结构详细信息
     */
    @GetMapping("/{filename}/info")
    public Result<InlayStructureInfo> getStructureInfo(@PathVariable String filename) {
        InlayStructureInfo info = inlayStructureService.getStructureInfo(filename);
        return Result.success(info);
    }

    /**
     * 获取镶嵌结构的预览图
     *
     * @param relativePath 相对路径（支持子目录，如 foo/bar.jcd）
     * @return 预览图文件
     */
    @GetMapping("/preview/{*relativePath}")
    public ResponseEntity<Resource> getPreview(@PathVariable("relativePath") String relativePath) {
        String identifier = decodeRelativePath(relativePath);
        Path previewPath = inlayStructureService.getPreviewPath(identifier);

        if (previewPath == null) {
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType("image/svg+xml"))
                    .header(HttpHeaders.CACHE_CONTROL, "public, max-age=3600")
                    .body(new ByteArrayResource(PREVIEW_PLACEHOLDER_SVG));
        }

        File file = previewPath.toFile();
        Resource resource = new FileSystemResource(file);

        // 根据文件扩展名确定Content-Type
        String contentType = "image/png";
        String lowerName = file.getName().toLowerCase();
        if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
            contentType = "image/jpeg";
        } else if (lowerName.endsWith(".gif")) {
            contentType = "image/gif";
        } else if (lowerName.endsWith(".webp")) {
            contentType = "image/webp";
        } else if (lowerName.endsWith(".bmp")) {
            contentType = "image/bmp";
        }

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.getName() + "\"")
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400, immutable")
                .body(resource);
    }

    /**
     * 上传新的镶嵌结构文件
     *
     * @param file 镶嵌结构文件（支持 .jcd, .obj, .glb, .stl, .step 格式）
     * @return 上传结果
     */
    @PostMapping("/upload")
    public Result<InlayStructureInfo> uploadStructure(
            @RequestParam("file") MultipartFile file) {

        if (file.isEmpty()) {
            throw new BusinessException("请上传文件");
        }

        String originalFilename = file.getOriginalFilename();
        log.info("收到镶嵌结构上传请求，文件名: {}, 大小: {} bytes",
                originalFilename, file.getSize());

        try {
            // 将上传文件保存到临时位置
            Path tempPath = java.nio.file.Files.createTempFile("inlay_upload_", "_" + originalFilename);
            file.transferTo(tempPath.toFile());

            // 保存到镶嵌结构数据库
            inlayStructureService.saveUploadedFile(originalFilename, tempPath);

            // 清理临时文件
            java.nio.file.Files.deleteIfExists(tempPath);

            // 返回新上传文件的信息
            InlayStructureInfo info = inlayStructureService.getStructureInfo(originalFilename);
            return Result.success("上传成功", info);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("上传镶嵌结构文件失败", e);
            throw new BusinessException("上传文件失败: " + e.getMessage());
        }
    }

    private static String buildPreviewUrl(String filePath) {
        String pathPart = Arrays.stream(filePath.split("/"))
                .map(segment -> URLEncoder.encode(segment, StandardCharsets.UTF_8).replace("+", "%20"))
                .collect(Collectors.joining("/"));
        return "/api/inlay/preview/" + pathPart;
    }

    private static String decodeRelativePath(String relativePath) {
        return relativePath.startsWith("/") ? relativePath.substring(1) : relativePath;
    }
}
