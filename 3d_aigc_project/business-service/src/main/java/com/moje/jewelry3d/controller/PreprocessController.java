package com.moje.jewelry3d.controller;

import com.moje.jewelry3d.common.Result;
import com.moje.jewelry3d.model.dto.PreprocessResponse;
import com.moje.jewelry3d.model.dto.SplitMultiViewResponse;
import com.moje.jewelry3d.service.PreprocessService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;

/**
 * 建模前图像预处理 API
 */
@Slf4j
@RestController
@RequestMapping("/api/preprocess")
public class PreprocessController {

    private final PreprocessService preprocessService;

    @Autowired
    public PreprocessController(PreprocessService preprocessService) {
        this.preprocessService = preprocessService;
    }

    @PostMapping("/remove-background")
    public Result<PreprocessResponse> removeBackground(
            @RequestParam("image") MultipartFile image
    ) {
        PreprocessResponse response = preprocessService.removeBackground(image);
        return Result.success("背景扣除完成", response);
    }

    @GetMapping("/preview/{sessionId}")
    public ResponseEntity<Resource> preview(@PathVariable String sessionId) {
        Path file = preprocessService.getPreviewFile(sessionId);
        Resource resource = new FileSystemResource(file.toFile());
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .body(resource);
    }

    @PostMapping("/save/{sessionId}")
    public Result<PreprocessResponse> saveProcessed(
            @PathVariable String sessionId,
            @RequestParam("image") MultipartFile image
    ) {
        PreprocessResponse response = preprocessService.saveProcessed(sessionId, image);
        return Result.success("手动微调已保存", response);
    }

    @PostMapping("/split-multi-view")
    public Result<SplitMultiViewResponse> splitMultiView(
            @RequestParam("image") MultipartFile image
    ) {
        SplitMultiViewResponse response = preprocessService.splitMultiView(image);
        return Result.success("多视图切分完成", response);
    }

    @GetMapping("/split-source/{sessionId}")
    public ResponseEntity<Resource> splitSource(@PathVariable String sessionId) {
        Path file = preprocessService.getSplitSourceFile(sessionId);
        Resource resource = new FileSystemResource(file.toFile());
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .body(resource);
    }

    @GetMapping("/split-crop/{sessionId}/{cropId}")
    public ResponseEntity<Resource> splitCrop(
            @PathVariable String sessionId,
            @PathVariable String cropId
    ) {
        Path file = preprocessService.getSplitCropFile(sessionId, cropId);
        Resource resource = new FileSystemResource(file.toFile());
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .body(resource);
    }
}
