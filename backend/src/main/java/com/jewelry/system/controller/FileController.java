package com.jewelry.system.controller;

import com.jewelry.system.entity.FileEntity;
import com.jewelry.system.repository.FileEntityRepository;
import com.jewelry.system.service.MinioStorageService;
import com.jewelry.system.service.AuditLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@RestController
@RequestMapping("/files")
@RequiredArgsConstructor
@Tag(name = "文件", description = "文件下载与删除")
public class FileController {

    private final FileEntityRepository fileEntityRepository;
    private final MinioStorageService minioStorageService;
    private final AuditLogService auditLogService;

    @GetMapping("/by-key/{*objectKey}")
    @Operation(summary = "按对象键读取本地存储文件（STORAGE_MODE=local）")
    public ResponseEntity<byte[]> getByKey(@PathVariable("objectKey") String objectKey) throws IOException {
        String key = objectKey == null ? "" : objectKey.replaceFirst("^/+", "");
        if (key.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "文件不存在");
        }
        byte[] body = minioStorageService.readObjectBytes(key);
        MediaType mediaType = MediaType.APPLICATION_OCTET_STREAM;
        try {
            String probed = Files.probeContentType(Path.of(key));
            if (probed != null && !probed.isBlank()) {
                mediaType = MediaType.parseMediaType(probed);
            }
        } catch (Exception ignored) {
            /* keep octet-stream */
        }
        return ResponseEntity.ok().contentType(mediaType).body(body);
    }

    @GetMapping("/{id:\\d+}/download")
    @Operation(summary = "下载文件")
    public ResponseEntity<Resource> download(@PathVariable long id) throws IOException {
        FileEntity e = fileEntityRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "文件不存在"));
        String url = e.getFileUrl();
        if (url == null || url.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "文件 URL 不存在");
        }
        auditLogService.log("FILE_DOWNLOAD", "FILE", e.getId(), "下载文件: " + e.getOriginalName());
        // 统一重定向到 OSS URL，由浏览器直接下载
        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, url)
                .build();
    }

    @GetMapping("/{id:\\d+}/preview")
    @Operation(summary = "预览（返回存储路径，前端可自行处理）")
    public String preview(@PathVariable long id) {
        FileEntity e = fileEntityRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "文件不存在"));
        String url = e.getFileUrl() != null ? e.getFileUrl() : e.getFilePath();
        auditLogService.log("FILE_PREVIEW", "FILE", e.getId(), "预览文件: " + e.getOriginalName());
        return url;
    }

    @DeleteMapping("/{id:\\d+}")
    @Operation(summary = "删除文件记录与磁盘文件")
    public void delete(@PathVariable long id) throws IOException {
        FileEntity e = fileEntityRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "文件不存在"));
        // filePath 存的是对象存储 objectKey
        minioStorageService.deleteObject(e.getFilePath());
        fileEntityRepository.delete(e);
        auditLogService.log("FILE_DELETE", "FILE", e.getId(), "删除文件: " + e.getOriginalName());
    }
}
