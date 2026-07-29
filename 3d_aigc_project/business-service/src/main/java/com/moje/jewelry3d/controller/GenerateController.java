package com.moje.jewelry3d.controller;

import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.common.Result;
import com.moje.jewelry3d.model.dto.GenerateResponse;
import com.moje.jewelry3d.model.dto.TaskViewDto;
import com.moje.jewelry3d.service.GenerateService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
public class GenerateController {

    private final GenerateService generateService;

    @Autowired
    public GenerateController(GenerateService generateService) {
        this.generateService = generateService;
    }

    @PostMapping("/api/generate/image-to-3d")
    public Result<GenerateResponse> imageTo3d(
            @RequestParam(value = "image", required = false) MultipartFile image,
            @RequestParam(value = "prompt", required = false) String prompt,
            @RequestParam(value = "output_format", required = false, defaultValue = "GLB") String outputFormat,
            @RequestParam(value = "inlay_structure_filename", required = false) String inlayStructureFilename,
            @RequestParam(value = "multi_view_enabled", required = false, defaultValue = "false") boolean multiViewEnabled,
            @RequestParam(value = "front_image", required = false) MultipartFile frontImage,
            @RequestParam(value = "back_image", required = false) MultipartFile backImage,
            @RequestParam(value = "left_image", required = false) MultipartFile leftImage,
            @RequestParam(value = "right_image", required = false) MultipartFile rightImage,
            @RequestParam(value = "top_image", required = false) MultipartFile topImage,
            @RequestParam(value = "bottom_image", required = false) MultipartFile bottomImage,
            @RequestParam(value = "generation_mode", required = false, defaultValue = "quality") String generationMode
    ) {
        Map<String, MultipartFile> viewFiles = new HashMap<>();
        putViewIfPresent(viewFiles, "front", frontImage);
        putViewIfPresent(viewFiles, "back", backImage);
        putViewIfPresent(viewFiles, "left", leftImage);
        putViewIfPresent(viewFiles, "right", rightImage);
        putViewIfPresent(viewFiles, "top", topImage);
        putViewIfPresent(viewFiles, "bottom", bottomImage);

        if (multiViewEnabled) {
            if (viewFiles.size() < 2) {
                throw new BusinessException("多视图模式下至少需要上传 2 个视角图片");
            }
        } else if (image == null || image.isEmpty()) {
            throw new BusinessException("请上传设计图文件");
        }

        GenerateResponse response = generateService.imageTo3d(
                image, prompt, outputFormat, inlayStructureFilename,
                multiViewEnabled, viewFiles, generationMode
        );
        return Result.success("生成任务已提交", response);
    }

    private static void putViewIfPresent(Map<String, MultipartFile> map, String key, MultipartFile file) {
        if (file != null && !file.isEmpty()) {
            map.put(key, file);
        }
    }

    @PostMapping("/api/generate/condition-generate")
    public Result<GenerateResponse> conditionGenerate(
            @RequestParam("image") MultipartFile image,
            @RequestParam(value = "inlay_structure_filename", required = false) String inlayStructureFilename,
            @RequestParam(value = "inlay_structure_file", required = false) MultipartFile inlayStructureFile,
            @RequestParam(value = "prompt", required = false) String prompt,
            @RequestParam(value = "output_format", required = false, defaultValue = "GLB") String outputFormat,
            @RequestParam(value = "inlay_type", required = false) String inlayType,
            @RequestParam(value = "gem_type", required = false) String gemType,
            @RequestParam(value = "generation_mode", required = false, defaultValue = "quality") String generationMode
    ) {
        if (image.isEmpty()) {
            throw new BusinessException("请上传设计图文件");
        }
        if ((inlayStructureFilename == null || inlayStructureFilename.isEmpty())
                && (inlayStructureFile == null || inlayStructureFile.isEmpty())) {
            throw new BusinessException("请选择或上传镶嵌底座");
        }
        GenerateResponse response = generateService.conditionGenerate(
                image, inlayStructureFilename, inlayStructureFile,
                prompt, outputFormat, inlayType, gemType, generationMode
        );
        return Result.success("条件生成任务已提交", response);
    }

    /** 前端兼容：条件生成别名 */
    @PostMapping("/api/generate/condition")
    public Result<GenerateResponse> conditionGenerateAlias(
            @RequestParam("image") MultipartFile image,
            @RequestParam(value = "inlay_structure_filename", required = false) String inlayStructureFilename,
            @RequestParam(value = "inlay", required = false) MultipartFile inlay,
            @RequestParam(value = "prompt", required = false) String prompt,
            @RequestParam(value = "output_format", required = false, defaultValue = "GLB") String outputFormat
    ) {
        return conditionGenerate(image, inlayStructureFilename, inlay, prompt, outputFormat, null, null, "quality");
    }

    @GetMapping("/api/generate/tasks")
    public Result<List<TaskViewDto>> getTasks() {
        return Result.success(generateService.getAllTaskViews());
    }

    /** 前端兼容：/api/tasks */
    @GetMapping("/api/tasks")
    public Result<Map<String, Object>> getTasksAlias(
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "page_size", defaultValue = "20") int pageSize
    ) {
        Page<TaskViewDto> taskPage = generateService.getTaskViews(page, pageSize);
        Map<String, Object> body = new HashMap<>();
        body.put("tasks", taskPage.getContent());
        body.put("total", taskPage.getTotalElements());
        return Result.success(body);
    }

    @GetMapping({"/api/generate/tasks/{taskId}", "/api/tasks/{taskId}"})
    public Result<TaskViewDto> getTaskDetail(@PathVariable String taskId) {
        return Result.success(generateService.getTaskView(taskId));
    }

    @GetMapping({"/api/generate/download/{taskId}", "/api/tasks/{taskId}/download"})
    public ResponseEntity<Resource> downloadResult(@PathVariable String taskId) {
        Path outputPath = generateService.getOutputFile(taskId);
        File file = outputPath.toFile();
        Resource resource = new FileSystemResource(file);
        String encodedFilename = URLEncoder.encode(file.getName(), StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .contentType(resolveDownloadMediaType(file.getName()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedFilename)
                .body(resource);
    }

    @GetMapping({"/api/generate/preview/{taskId}", "/api/tasks/{taskId}/preview"})
    public ResponseEntity<Resource> previewResult(@PathVariable String taskId) {
        final Path previewPath;
        try {
            previewPath = generateService.getPreviewFile(taskId);
        } catch (BusinessException e) {
            int status = e.getCode() >= 400 && e.getCode() < 600 ? e.getCode() : 404;
            return ResponseEntity.status(status).build();
        }
        File file = previewPath.toFile();
        Resource resource = new FileSystemResource(file);
        return ResponseEntity.ok()
                .contentType(resolveDownloadMediaType(file.getName()))
                .contentLength(file.length())
                .cacheControl(org.springframework.http.CacheControl.maxAge(7, java.util.concurrent.TimeUnit.DAYS).cachePublic())
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename*=UTF-8''" + URLEncoder.encode(file.getName(), StandardCharsets.UTF_8).replace("+", "%20"))
                .body(resource);
    }

    @GetMapping({"/api/generate/input-preview/{taskId}", "/api/tasks/{taskId}/input-preview"})
    public ResponseEntity<Resource> previewInput(@PathVariable String taskId) {
        Path inputPath = generateService.getInputImageFile(taskId);
        File file = inputPath.toFile();
        Resource resource = new FileSystemResource(file);
        return ResponseEntity.ok()
                .contentType(resolveImageMediaType(file.getName()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename*=UTF-8''" + URLEncoder.encode(file.getName(), StandardCharsets.UTF_8).replace("+", "%20"))
                .body(resource);
    }

    private MediaType resolveImageMediaType(String filename) {
        String lower = filename.toLowerCase();
        if (lower.endsWith(".png")) {
            return MediaType.IMAGE_PNG;
        }
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
            return MediaType.IMAGE_JPEG;
        }
        if (lower.endsWith(".webp")) {
            return MediaType.parseMediaType("image/webp");
        }
        return MediaType.APPLICATION_OCTET_STREAM;
    }

    private MediaType resolveDownloadMediaType(String filename) {
        String lower = filename.toLowerCase();
        if (lower.endsWith(".glb")) {
            return MediaType.parseMediaType("model/gltf-binary");
        }
        if (lower.endsWith(".gltf")) {
            return MediaType.parseMediaType("model/gltf+json");
        }
        return MediaType.APPLICATION_OCTET_STREAM;
    }

    @DeleteMapping({"/api/generate/tasks/{taskId}", "/api/tasks/{taskId}"})
    public Result<Void> deleteTask(@PathVariable String taskId) {
        generateService.deleteTask(taskId);
        return Result.success("任务已删除", null);
    }
}
