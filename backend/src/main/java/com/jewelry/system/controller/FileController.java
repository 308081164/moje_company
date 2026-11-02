package com.jewelry.system.controller;

import com.jewelry.system.entity.FileEntity;
import com.jewelry.system.repository.FileEntityRepository;
import com.jewelry.system.service.MinioStorageService;
import com.jewelry.system.service.AuditLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
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
    @Operation(summary = "下载文件（经后端鉴权后直接返回字节流，供员工端预览/下载；不再 302 跳转）")
    public ResponseEntity<byte[]> download(@PathVariable long id) throws IOException {
        FileEntity e = fileEntityRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "文件不存在"));
        String objectKey = e.getFilePath();
        if (!StringUtils.hasText(objectKey)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "文件存储路径不存在");
        }
        byte[] body;
        try {
            body = minioStorageService.readObjectBytes(objectKey.trim());
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "文件内容不可读: " + ex.getMessage());
        }
        String filename = StringUtils.hasText(e.getOriginalName())
                ? e.getOriginalName()
                : (StringUtils.hasText(e.getFileName()) ? e.getFileName() : ("file-" + id));
        // Tomcat 不允许响应头出现非 ISO-8859-1 字符；中文名只能放在 filename*=UTF-8'' 段
        String asciiName = asciiDownloadFilename(filename, id);
        String encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");
        MediaType mediaType = guessMediaType(filename, e.getFileExtension());
        auditLogService.log("FILE_DOWNLOAD", "FILE", e.getId(), "下载文件: " + filename);
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + asciiName + "\"; filename*=UTF-8''" + encoded)
                .contentLength(body.length)
                .body(body);
    }

    /** filename= 仅 ASCII，避免中文原名触发 Tomcat 丢弃 Content-Disposition 甚至写头失败。 */
    static String asciiDownloadFilename(String filename, long id) {
        String base = filename == null ? "" : filename.trim();
        StringBuilder sb = new StringBuilder(base.length());
        for (int i = 0; i < base.length(); i++) {
            char c = base.charAt(i);
            if (c >= 0x20 && c <= 0x7E && c != '"' && c != '\\' && c != ';') {
                sb.append(c);
            } else if (Character.isWhitespace(c)) {
                sb.append('_');
            }
        }
        String ascii = sb.toString().replaceAll("^\\.+", "");
        if (ascii.isBlank() || ".".equals(ascii)) {
            String ext = "";
            int dot = base.lastIndexOf('.');
            if (dot >= 0 && dot < base.length() - 1) {
                String rawExt = base.substring(dot + 1).replaceAll("[^A-Za-z0-9]", "");
                if (!rawExt.isBlank()) {
                    ext = "." + rawExt;
                }
            }
            ascii = "file-" + id + ext;
        }
        return ascii;
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
        minioStorageService.deleteObject(e.getFilePath());
        fileEntityRepository.delete(e);
        auditLogService.log("FILE_DELETE", "FILE", e.getId(), "删除文件: " + e.getOriginalName());
    }

    private static MediaType guessMediaType(String filename, String extension) {
        String ext = extension != null ? extension.trim().toLowerCase() : "";
        if (ext.isBlank() && filename != null && filename.contains(".")) {
            ext = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
        }
        return switch (ext) {
            case "png" -> MediaType.IMAGE_PNG;
            case "jpg", "jpeg" -> MediaType.IMAGE_JPEG;
            case "gif" -> MediaType.IMAGE_GIF;
            case "webp" -> MediaType.parseMediaType("image/webp");
            case "pdf" -> MediaType.APPLICATION_PDF;
            case "stl" -> MediaType.parseMediaType("model/stl");
            case "obj" -> MediaType.parseMediaType("model/obj");
            case "glb" -> MediaType.parseMediaType("model/gltf-binary");
            case "gltf" -> MediaType.parseMediaType("model/gltf+json");
            case "step", "stp" -> MediaType.parseMediaType("application/step");
            default -> MediaType.APPLICATION_OCTET_STREAM;
        };
    }
}
