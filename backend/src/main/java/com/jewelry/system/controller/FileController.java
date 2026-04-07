package com.jewelry.system.controller;

import com.jewelry.system.entity.FileEntity;
import com.jewelry.system.repository.FileEntityRepository;
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
    private final AuditLogService auditLogService;

    @GetMapping("/{id:\\d+}/download")
    @Operation(summary = "下载文件")
    public ResponseEntity<Resource> download(@PathVariable long id) throws IOException {
        FileEntity e = fileEntityRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "文件不存在"));
        Path path = Path.of(e.getFilePath());
        if (!Files.isRegularFile(path)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "文件已丢失");
        }
        Resource resource = new FileSystemResource(path);
        String ct = Files.probeContentType(path);
        MediaType mediaType = ct != null ? MediaType.parseMediaType(ct) : MediaType.APPLICATION_OCTET_STREAM;
        auditLogService.log("FILE_DOWNLOAD", "FILE", e.getId(), "下载文件: " + e.getOriginalName());
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + e.getOriginalName() + "\"")
                .body(resource);
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
        Path path = Path.of(e.getFilePath());
        Files.deleteIfExists(path);
        fileEntityRepository.delete(e);
        auditLogService.log("FILE_DELETE", "FILE", e.getId(), "删除文件: " + e.getOriginalName());
    }
}
