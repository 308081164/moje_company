package com.moje.jewelry3d.controller;

import com.moje.jewelry3d.common.Result;
import com.moje.jewelry3d.model.dto.GemSegmentResponse;
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

    @PostMapping("/gem-flatten")
    public Result<PreprocessResponse> gemFlatten(
            @RequestParam("image") MultipartFile image,
            @RequestParam(value = "gem_preset", defaultValue = "ruby") String gemPreset,
            @RequestParam(value = "custom_color", required = false) String customColor,
            @RequestParam(value = "sensitivity", required = false) Double sensitivity,
            @RequestParam(value = "preserve_edges", defaultValue = "true") Boolean preserveEdges
    ) {
        PreprocessResponse response = preprocessService.gemFlatten(
                image, gemPreset, customColor, sensitivity, preserveEdges
        );
        String ratio = response.getGemCoverageRatio() != null
                ? String.format("，覆盖约 %.1f%% 前景", response.getGemCoverageRatio() * 100)
                : "";
        return Result.success("宝石占位色完成" + ratio, response);
    }

    @PostMapping("/gem-segment-sam")
    public Result<GemSegmentResponse> gemSegmentSam(
            @RequestParam("image") MultipartFile image,
            @RequestParam("points_json") String pointsJson,
            @RequestParam(value = "session_id", required = false) String sessionId
    ) {
        GemSegmentResponse response = preprocessService.gemSegmentSam(image, pointsJson, sessionId);
        String ratio = response.getGemCoverageRatio() != null
                ? String.format("，覆盖约 %.1f%% 前景", response.getGemCoverageRatio() * 100)
                : "";
        return Result.success("蒙版预览完成" + ratio, response);
    }

    @PostMapping("/gem-flatten-sam")
    public Result<PreprocessResponse> gemFlattenSam(
            @RequestParam("image") MultipartFile image,
            @RequestParam("points_json") String pointsJson,
            @RequestParam(value = "session_id", required = false) String sessionId,
            @RequestParam(value = "gem_preset", defaultValue = "ruby") String gemPreset,
            @RequestParam(value = "custom_color", required = false) String customColor,
            @RequestParam(value = "preserve_edges", defaultValue = "true") Boolean preserveEdges
    ) {
        PreprocessResponse response = preprocessService.gemFlattenSam(
                image, pointsJson, sessionId, gemPreset, customColor, preserveEdges
        );
        String ratio = response.getGemCoverageRatio() != null
                ? String.format("，覆盖约 %.1f%% 前景", response.getGemCoverageRatio() * 100)
                : "";
        return Result.success("SAM 宝石占位色完成" + ratio, response);
    }

    @PostMapping("/gem-repaint")
    public Result<PreprocessResponse> gemRepaint(
            @RequestParam("image") MultipartFile image,
            @RequestParam(value = "mask", required = false) MultipartFile mask,
            @RequestParam(value = "use_mask", defaultValue = "true") Boolean useMask,
            @RequestParam(value = "points_json", required = false) String pointsJson,
            @RequestParam(value = "session_id", required = false) String sessionId,
            @RequestParam(value = "prompt", required = false) String prompt,
            @RequestParam(value = "strength", defaultValue = "0.20") Double strength,
            @RequestParam(value = "mask_dilate_px", defaultValue = "8") Integer maskDilatePx,
            @RequestParam(value = "preserve_edges", defaultValue = "true") Boolean preserveEdges,
            @RequestParam(value = "seed", required = false) Integer seed,
            @RequestParam(value = "sensitivity", required = false) Double sensitivity
    ) {
        PreprocessResponse response = preprocessService.gemRepaintSam(
                image, mask, useMask, pointsJson, sessionId, prompt, strength, maskDilatePx, preserveEdges, seed, sensitivity
        );
        String ratio = response.getGemCoverageRatio() != null
                ? String.format("，宝石区域约 %.1f%%", response.getGemCoverageRatio() * 100)
                : "";
        String mode = "wanx_mask".equals(response.getSegmentMethod()) ? "蒙版" : "整图";
        return Result.success("AI 去反光" + mode + "重绘完成" + ratio, response);
    }

    @GetMapping("/gem-mask/{sessionId}")
    public ResponseEntity<Resource> gemMaskPreview(@PathVariable String sessionId) {
        Path file = preprocessService.getGemMaskPreviewFile(sessionId);
        Resource resource = new FileSystemResource(file.toFile());
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .body(resource);
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
