package com.moje.jewelry3d.controller;

import com.moje.jewelry3d.common.Result;
import com.moje.jewelry3d.model.dto.MeshConvertResponse;
import com.moje.jewelry3d.service.MeshConvertService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 3D 网格格式转换 API
 */
@Slf4j
@RestController
@RequestMapping("/api/mesh")
public class MeshConvertController {

    private static final List<String> FORMATS = List.of("obj", "glb", "stl");

    private final MeshConvertService meshConvertService;

    @Autowired
    public MeshConvertController(MeshConvertService meshConvertService) {
        this.meshConvertService = meshConvertService;
    }

    @GetMapping("/convert/formats")
    public Result<Map<String, Object>> formats() {
        Map<String, List<String>> matrix = new LinkedHashMap<>();
        for (String src : FORMATS) {
            matrix.put(src.toUpperCase(), FORMATS.stream()
                    .filter(f -> !f.equals(src))
                    .map(String::toUpperCase)
                    .toList());
        }
        Map<String, Object> data = Map.of(
                "formats", FORMATS.stream().map(String::toUpperCase).toList(),
                "matrix", matrix
        );
        return Result.success(data);
    }

    @PostMapping("/convert")
    public Result<MeshConvertResponse> convert(
            @RequestParam("file") MultipartFile file,
            @RequestParam("output_format") String outputFormat
    ) {
        MeshConvertResponse response = meshConvertService.convert(file, outputFormat);
        return Result.success(
                String.format("转换完成：%s → %s", response.getSourceFormat(), response.getOutputFormat()),
                response
        );
    }

    @GetMapping("/convert/{sessionId}/download")
    public ResponseEntity<Resource> download(@PathVariable String sessionId) {
        Path file = meshConvertService.getConvertedFile(sessionId);
        String filename = file.getFileName().toString();
        Resource resource = new FileSystemResource(file.toFile());
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(meshConvertService.getConvertedContentType(sessionId)))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(resource);
    }

    @GetMapping("/convert/{sessionId}/preview")
    public ResponseEntity<Resource> preview(@PathVariable String sessionId) {
        Path file = meshConvertService.getConvertedFile(sessionId);
        String filename = file.getFileName().toString();
        Resource resource = new FileSystemResource(file.toFile());
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(meshConvertService.getConvertedContentType(sessionId)))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .body(resource);
    }
}
