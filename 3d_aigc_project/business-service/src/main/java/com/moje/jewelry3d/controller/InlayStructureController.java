package com.moje.jewelry3d.controller;

import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.common.Result;
import com.moje.jewelry3d.model.dto.InlayStructureInfo;
import com.moje.jewelry3d.service.InlayStructureService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
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
import java.util.List;

/**
 * 镶嵌结构管理控制器
 * 提供镶嵌结构数据库的查询、预览和上传功能
 */
@Slf4j
@RestController
@RequestMapping("/api/inlay")
public class InlayStructureController {

    private final InlayStructureService inlayStructureService;

    @Autowired
    public InlayStructureController(InlayStructureService inlayStructureService) {
        this.inlayStructureService = inlayStructureService;
    }

    /**
     * 列出所有镶嵌结构
     *
     * @return 镶嵌结构信息列表
     */
    @GetMapping("/list")
    public Result<List<InlayStructureInfo>> listStructures() {
        List<InlayStructureInfo> structures = inlayStructureService.listAllStructures();
        return Result.success(structures);
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
     * @param filename 文件名
     * @return 预览图文件
     */
    @GetMapping("/{filename}/preview")
    public ResponseEntity<Resource> getPreview(@PathVariable String filename) {
        Path previewPath = inlayStructureService.getPreviewPath(filename);

        if (previewPath == null) {
            throw new BusinessException(404, "该镶嵌结构没有预览图: " + filename);
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
        }

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.getName() + "\"")
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
}
