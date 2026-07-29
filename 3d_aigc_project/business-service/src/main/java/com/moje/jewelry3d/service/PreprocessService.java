package com.moje.jewelry3d.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.config.AiServiceConfig;
import com.moje.jewelry3d.config.FileStorageConfig;
import com.moje.jewelry3d.model.dto.GemSegmentResponse;
import com.moje.jewelry3d.model.dto.PreprocessResponse;
import com.moje.jewelry3d.model.dto.SplitMultiViewResponse;
import com.moje.jewelry3d.model.dto.ViewCropDto;
import com.moje.jewelry3d.service.cloud.CloudGemRepaintService;
import com.moje.jewelry3d.service.cloud.CloudGemRepaintService.RepaintOutcome;
import com.moje.jewelry3d.util.GemMaskArtifactUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 建模前图像预处理业务
 */
@Slf4j
@Service
public class PreprocessService {

    private final AiServiceClient aiServiceClient;
    private final AiServiceConfig aiServiceConfig;
    private final FileStorageConfig fileStorageConfig;
    private final CloudGemRepaintService cloudGemRepaintService;

    @Autowired
    public PreprocessService(
            AiServiceClient aiServiceClient,
            AiServiceConfig aiServiceConfig,
            FileStorageConfig fileStorageConfig,
            CloudGemRepaintService cloudGemRepaintService
    ) {
        this.aiServiceClient = aiServiceClient;
        this.aiServiceConfig = aiServiceConfig;
        this.fileStorageConfig = fileStorageConfig;
        this.cloudGemRepaintService = cloudGemRepaintService;
    }

    public PreprocessResponse removeBackground(MultipartFile imageFile) {
        if (imageFile == null || imageFile.isEmpty()) {
            throw new BusinessException("请上传图像文件");
        }

        String sessionId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        Path sessionDir = fileStorageConfig.getUploadPath().resolve("preprocess").resolve(sessionId);

        try {
            Files.createDirectories(sessionDir);
            String ext = resolveImageExt(imageFile.getOriginalFilename());
            Path inputPath = sessionDir.resolve("input" + ext);
            saveMultipartFile(imageFile, inputPath);

            JsonNode aiResult = aiServiceClient.callRemoveBackground(
                    inputPath.toString(),
                    sessionId
            );

            if (!aiResult.path("success").asBoolean(false)) {
                throw new BusinessException("AI 背景扣除失败");
            }

            String aiProcessedPath = aiResult.path("processed_path").asText(null);
            Path localProcessed = sessionDir.resolve("no_bg.png");

            if (aiProcessedPath != null && !aiProcessedPath.isBlank()) {
                Path aiSource = resolveAiProcessedPath(aiProcessedPath, sessionId);
                if (aiSource != null && Files.exists(aiSource)) {
                    Files.copy(aiSource, localProcessed, StandardCopyOption.REPLACE_EXISTING);
                }
            }

            if (!Files.exists(localProcessed)) {
                throw new BusinessException("预处理结果文件未生成，请检查 AI 服务");
            }

            PreprocessResponse response = new PreprocessResponse();
            response.setSessionId(sessionId);
            response.setProcessedPath(localProcessed.toString());
            response.setOriginalPath(inputPath.toString());
            response.setPreviewUrl("/preprocess/preview/" + sessionId);
            return response;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("背景扣除失败", e);
            throw new BusinessException("背景扣除失败: " + e.getMessage(), e);
        }
    }

    public Path getPreviewFile(String sessionId) {
        Path dir = fileStorageConfig.getUploadPath()
                .resolve("preprocess")
                .resolve(sessionId);
        Path gemRepaint = dir.resolve("gem_repaint.png");
        if (Files.exists(gemRepaint)) {
            return gemRepaint;
        }
        Path gemFlat = dir.resolve("gem_flat.png");
        if (Files.exists(gemFlat)) {
            return gemFlat;
        }
        Path file = dir.resolve("no_bg.png");
        if (!Files.exists(file)) {
            throw new BusinessException(404, "预处理预览不存在: " + sessionId);
        }
        return file;
    }

    public PreprocessResponse gemFlatten(
            MultipartFile imageFile,
            String gemPreset,
            String customColor,
            Double sensitivity,
            Boolean preserveEdges
    ) {
        if (imageFile == null || imageFile.isEmpty()) {
            throw new BusinessException("请上传图像文件");
        }

        String sessionId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        Path sessionDir = fileStorageConfig.getUploadPath().resolve("preprocess").resolve(sessionId);
        double sens = sensitivity != null ? sensitivity : 0.55;
        boolean keepEdges = preserveEdges == null || preserveEdges;

        try {
            Files.createDirectories(sessionDir);
            String ext = resolveImageExt(imageFile.getOriginalFilename());
            Path inputPath = sessionDir.resolve("input" + ext);
            saveMultipartFile(imageFile, inputPath);

            JsonNode aiResult = aiServiceClient.callGemFlatten(
                    inputPath.toString(),
                    sessionId,
                    gemPreset,
                    customColor,
                    sens,
                    keepEdges
            );

            if (!aiResult.path("success").asBoolean(false)) {
                throw new BusinessException("AI 宝石占位色处理失败");
            }

            Path localProcessed = sessionDir.resolve("no_bg.png");
            String aiProcessedPath = aiResult.path("processed_path").asText(null);
            if (aiProcessedPath != null && !aiProcessedPath.isBlank()) {
                Path aiSource = resolveAiProcessedPath(aiProcessedPath, sessionId);
                if (aiSource != null && Files.exists(aiSource)) {
                    Files.copy(aiSource, localProcessed, StandardCopyOption.REPLACE_EXISTING);
                    Files.copy(aiSource, sessionDir.resolve("gem_flat.png"), StandardCopyOption.REPLACE_EXISTING);
                }
            }

            if (!Files.exists(localProcessed)) {
                throw new BusinessException("宝石占位色结果未生成，请检查 AI 服务");
            }

            PreprocessResponse response = new PreprocessResponse();
            response.setSessionId(sessionId);
            response.setProcessedPath(localProcessed.toString());
            response.setOriginalPath(inputPath.toString());
            response.setPreviewUrl("/preprocess/preview/" + sessionId);
            if (aiResult.has("gem_coverage_ratio")) {
                response.setGemCoverageRatio(aiResult.path("gem_coverage_ratio").asDouble(0));
            }
            response.setGemPreset(aiResult.path("gem_preset").asText(gemPreset));
            if (aiResult.has("segment_method")) {
                response.setSegmentMethod(aiResult.path("segment_method").asText(null));
            }
            copyOptionalArtifact(sessionDir, aiResult, "mask_preview_url", "gem_mask_overlay.png");
            if (Files.exists(sessionDir.resolve("gem_mask_overlay.png"))) {
                response.setMaskPreviewUrl("/preprocess/gem-mask/" + sessionId);
            }
            return response;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("宝石占位色失败", e);
            throw new BusinessException("宝石占位色失败: " + e.getMessage(), e);
        }
    }

    public GemSegmentResponse gemSegmentSam(
            MultipartFile imageFile,
            String pointsJson,
            String sessionId
    ) {
        if (imageFile == null || imageFile.isEmpty()) {
            throw new BusinessException("请上传图像文件");
        }
        if (pointsJson == null || pointsJson.isBlank()) {
            throw new BusinessException("请提供点选坐标");
        }

        String sid = sessionId != null && !sessionId.isBlank()
                ? sessionId
                : UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        Path sessionDir = fileStorageConfig.getUploadPath().resolve("preprocess").resolve(sid);

        try {
            Files.createDirectories(sessionDir);
            String ext = resolveImageExt(imageFile.getOriginalFilename());
            Path inputPath = sessionDir.resolve("input" + ext);
            saveMultipartFile(imageFile, inputPath);

            JsonNode aiResult = aiServiceClient.callGemSegmentSam(
                    inputPath.toString(), sid, pointsJson
            );

            copyOptionalArtifact(sessionDir, aiResult, "mask_preview_url", "gem_mask_overlay.png");

            GemSegmentResponse response = new GemSegmentResponse();
            response.setSessionId(sid);
            response.setGemCoverageRatio(aiResult.path("gem_coverage_ratio").asDouble(0));
            response.setSegmentEngine(aiResult.path("segment_engine").asText("sam2"));
            response.setMaskPreviewUrl("/preprocess/gem-mask/" + sid);
            return response;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("SAM 宝石蒙版预览失败", e);
            throw new BusinessException("SAM 宝石蒙版预览失败: " + e.getMessage(), e);
        }
    }

    public PreprocessResponse gemFlattenSam(
            MultipartFile imageFile,
            String pointsJson,
            String sessionId,
            String gemPreset,
            String customColor,
            Boolean preserveEdges
    ) {
        if (imageFile == null || imageFile.isEmpty()) {
            throw new BusinessException("请上传图像文件");
        }
        if (pointsJson == null || pointsJson.isBlank()) {
            throw new BusinessException("请提供点选坐标");
        }

        String sid = sessionId != null && !sessionId.isBlank()
                ? sessionId
                : UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        Path sessionDir = fileStorageConfig.getUploadPath().resolve("preprocess").resolve(sid);
        boolean keepEdges = preserveEdges == null || preserveEdges;

        try {
            Files.createDirectories(sessionDir);
            String ext = resolveImageExt(imageFile.getOriginalFilename());
            Path inputPath = sessionDir.resolve("input" + ext);
            saveMultipartFile(imageFile, inputPath);

            JsonNode aiResult = aiServiceClient.callGemFlattenSam(
                    inputPath.toString(),
                    sid,
                    pointsJson,
                    gemPreset,
                    customColor,
                    keepEdges
            );

            Path localProcessed = sessionDir.resolve("no_bg.png");
            String aiProcessedPath = aiResult.path("processed_path").asText(null);
            if (aiProcessedPath != null && !aiProcessedPath.isBlank()) {
                Path aiSource = resolveAiProcessedPath(aiProcessedPath, sid);
                if (aiSource != null && Files.exists(aiSource)) {
                    Files.copy(aiSource, localProcessed, StandardCopyOption.REPLACE_EXISTING);
                    Files.copy(aiSource, sessionDir.resolve("gem_flat.png"), StandardCopyOption.REPLACE_EXISTING);
                }
            }

            if (!Files.exists(localProcessed)) {
                throw new BusinessException("SAM 宝石占位色结果未生成，请检查 AI 服务");
            }

            copyOptionalArtifact(sessionDir, aiResult, "mask_preview_url", "gem_mask_overlay.png");

            PreprocessResponse response = new PreprocessResponse();
            response.setSessionId(sid);
            response.setProcessedPath(localProcessed.toString());
            response.setOriginalPath(inputPath.toString());
            response.setPreviewUrl("/preprocess/preview/" + sid);
            response.setGemCoverageRatio(aiResult.path("gem_coverage_ratio").asDouble(0));
            response.setGemPreset(aiResult.path("gem_preset").asText(gemPreset));
            response.setSegmentMethod(aiResult.path("segment_method").asText("sam"));
            if (Files.exists(sessionDir.resolve("gem_mask_overlay.png"))) {
                response.setMaskPreviewUrl("/preprocess/gem-mask/" + sid);
            }
            return response;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("SAM 宝石占位色失败", e);
            throw new BusinessException("SAM 宝石占位色失败: " + e.getMessage(), e);
        }
    }

    public PreprocessResponse gemRepaintSam(
            MultipartFile imageFile,
            MultipartFile maskFile,
            Boolean useMask,
            String pointsJson,
            String sessionId,
            String prompt,
            Double strength,
            Integer maskDilatePx,
            Boolean preserveEdges,
            Integer seed,
            Double sensitivity
    ) {
        if (imageFile == null || imageFile.isEmpty()) {
            throw new BusinessException("请上传图像文件");
        }
        boolean maskMode = useMask == null || useMask;
        if (maskMode && (maskFile == null || maskFile.isEmpty())) {
            throw new BusinessException("请上传或绘制宝石蒙版（白色区域为待去反光的主石）");
        }

        String sid = sessionId != null && !sessionId.isBlank()
                ? sessionId
                : UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        Path sessionDir = fileStorageConfig.getUploadPath().resolve("preprocess").resolve(sid);
        double strengthVal = strength != null ? Math.max(0.08, Math.min(0.45, strength)) : 0.20;

        try {
            Files.createDirectories(sessionDir);
            String ext = resolveImageExt(imageFile.getOriginalFilename());
            Path inputPath = sessionDir.resolve("input" + ext);
            saveMultipartFile(imageFile, inputPath);

            RepaintOutcome outcome;
            String segmentMethod;
            Double coverageRatio = null;
            String maskPreviewUrl = null;

            if (maskMode) {
                Path maskPath = sessionDir.resolve("gem_mask.png");
                saveMultipartFile(maskFile, maskPath);
                GemMaskArtifactUtil.writeOverlayPreview(inputPath, maskPath, sessionDir.resolve("gem_mask_overlay.png"));
                coverageRatio = GemMaskArtifactUtil.computeWhiteCoverage(maskPath);
                maskPreviewUrl = "/preprocess/gem-mask/" + sid;
                outcome = cloudGemRepaintService.repaintWithMask(inputPath, maskPath, prompt, strengthVal);
                segmentMethod = "wanx_mask";
            } else {
                outcome = cloudGemRepaintService.repaint(inputPath, prompt, strengthVal);
                segmentMethod = "wanx_full";
            }

            Path localProcessed = sessionDir.resolve("no_bg.png");
            Path gemRepaintPath = sessionDir.resolve("gem_repaint.png");
            Files.write(localProcessed, outcome.imageBytes());
            Files.write(gemRepaintPath, outcome.imageBytes());

            PreprocessResponse response = new PreprocessResponse();
            response.setSessionId(sid);
            response.setProcessedPath(localProcessed.toString());
            response.setOriginalPath(inputPath.toString());
            response.setPreviewUrl("/preprocess/preview/" + sid);
            response.setSegmentMethod(segmentMethod);
            response.setRepaintMethod(outcome.repaintMethod());
            response.setGemCoverageRatio(coverageRatio);
            response.setMaskPreviewUrl(maskPreviewUrl);
            return response;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("宝石去反光重绘失败", e);
            throw new BusinessException("宝石去反光重绘失败: " + e.getMessage(), e);
        }
    }

    public Path getGemMaskPreviewFile(String sessionId) {
        Path file = fileStorageConfig.getUploadPath()
                .resolve("preprocess")
                .resolve(sessionId)
                .resolve("gem_mask_overlay.png");
        if (!Files.exists(file)) {
            throw new BusinessException(404, "蒙版预览不存在: " + sessionId);
        }
        return file;
    }

    private void copyOptionalArtifact(
            Path sessionDir,
            JsonNode aiResult,
            String urlField,
            String localName
    ) throws IOException {
        String preview = aiResult.path(urlField).asText(null);
        if (preview == null || preview.isBlank()) {
            return;
        }
        Path aiSource = resolveAiProcessedPathFromPreview(preview, sessionDir.getFileName().toString(), localName);
        if (aiSource != null && Files.exists(aiSource)) {
            Files.copy(aiSource, sessionDir.resolve(localName), StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private Path resolveAiProcessedPathFromPreview(String previewUrl, String sessionId, String filename) {
        if (previewUrl.contains("/preprocess/" + sessionId + "/")) {
            Path bySession = aiServiceConfig.getOutputPath()
                    .resolve("preprocess")
                    .resolve(sessionId)
                    .resolve(filename);
            if (Files.exists(bySession)) {
                return bySession.normalize();
            }
        }
        return null;
    }

    public PreprocessResponse saveProcessed(String sessionId, MultipartFile imageFile) {
        if (imageFile == null || imageFile.isEmpty()) {
            throw new BusinessException("请上传处理后的图像");
        }

        Path sessionDir = fileStorageConfig.getUploadPath()
                .resolve("preprocess")
                .resolve(sessionId);
        if (!Files.isDirectory(sessionDir)) {
            throw new BusinessException(404, "预处理会话不存在: " + sessionId);
        }

        Path localProcessed = sessionDir.resolve("no_bg.png");
        try {
            saveMultipartFile(imageFile, localProcessed);
        } catch (IOException e) {
            log.error("保存手动微调结果失败, sessionId={}", sessionId, e);
            throw new BusinessException("保存失败: " + e.getMessage(), e);
        }

        PreprocessResponse response = new PreprocessResponse();
        response.setSessionId(sessionId);
        response.setProcessedPath(localProcessed.toString());
        response.setPreviewUrl("/preprocess/preview/" + sessionId);
        return response;
    }

    public SplitMultiViewResponse splitMultiView(MultipartFile imageFile) {
        if (imageFile == null || imageFile.isEmpty()) {
            throw new BusinessException("请上传 CAD 合一图");
        }

        String sessionId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        Path sessionDir = fileStorageConfig.getUploadPath().resolve("preprocess").resolve(sessionId);

        try {
            Files.createDirectories(sessionDir);
            String ext = resolveImageExt(imageFile.getOriginalFilename());
            Path inputPath = sessionDir.resolve("sheet_input" + ext);
            saveMultipartFile(imageFile, inputPath);

            JsonNode aiResult = aiServiceClient.callSplitMultiView(
                    inputPath.toString(),
                    sessionId
            );

            if (!aiResult.path("success").asBoolean(false)) {
                throw new BusinessException("多视图切分失败");
            }

            SplitMultiViewResponse response = new SplitMultiViewResponse();
            response.setSessionId(sessionId);
            response.setSourceWidth(aiResult.path("source_width").asInt(0));
            response.setSourceHeight(aiResult.path("source_height").asInt(0));
            response.setSourcePreviewUrl("/preprocess/split-source/" + sessionId);

            List<ViewCropDto> crops = new ArrayList<>();
            JsonNode cropNodes = aiResult.path("crops");
            if (cropNodes.isArray()) {
                for (JsonNode node : cropNodes) {
                    String cropId = node.path("id").asText("");
                    if (cropId.isBlank()) {
                        continue;
                    }
                    Path localCrop = sessionDir.resolve(cropId + ".png");
                    String aiCropPath = node.path("processed_path").asText(null);
                    if (aiCropPath != null && !aiCropPath.isBlank()) {
                        Path aiSource = resolveAiProcessedPath(aiCropPath, sessionId);
                        if (aiSource != null && Files.exists(aiSource)) {
                            Files.copy(aiSource, localCrop, StandardCopyOption.REPLACE_EXISTING);
                        }
                    }

                    ViewCropDto crop = new ViewCropDto();
                    crop.setId(cropId);
                    crop.setX(node.path("x").asInt(0));
                    crop.setY(node.path("y").asInt(0));
                    crop.setWidth(node.path("width").asInt(0));
                    crop.setHeight(node.path("height").asInt(0));
                    String guess = node.path("guess").asText(null);
                    if (guess != null && !guess.isBlank() && !"null".equals(guess)) {
                        crop.setGuess(guess);
                    }
                    crop.setPreviewUrl("/preprocess/split-crop/" + sessionId + "/" + cropId);
                    crops.add(crop);
                }
            }

            if (crops.isEmpty()) {
                throw new BusinessException("未切分出有效视图，请换一张更清晰的 CAD 合一图");
            }

            response.setCrops(crops);
            return response;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("多视图切分失败", e);
            throw new BusinessException("多视图切分失败: " + e.getMessage(), e);
        }
    }

    public Path getSplitSourceFile(String sessionId) {
        Path dir = fileStorageConfig.getUploadPath().resolve("preprocess").resolve(sessionId);
        for (String name : new String[]{"sheet_input.png", "sheet_input.jpg", "sheet_input.jpeg", "sheet_input.bmp", "sheet_input.webp"}) {
            Path file = dir.resolve(name);
            if (Files.exists(file)) {
                return file;
            }
        }
        throw new BusinessException(404, "切分原图不存在: " + sessionId);
    }

    public Path getSplitCropFile(String sessionId, String cropId) {
        if (cropId == null || cropId.isBlank() || cropId.contains("..") || cropId.contains("/")) {
            throw new BusinessException(400, "无效的 crop id");
        }
        Path file = fileStorageConfig.getUploadPath()
                .resolve("preprocess")
                .resolve(sessionId)
                .resolve(cropId + ".png");
        if (!Files.exists(file)) {
            throw new BusinessException(404, "切分预览不存在: " + sessionId + "/" + cropId);
        }
        return file;
    }

    private Path resolveAiProcessedPath(String aiPath, String sessionId) {
        Path direct = Path.of(aiPath);
        if (direct.isAbsolute() && Files.exists(direct)) {
            return direct.normalize();
        }

        String normalized = aiPath.replace('\\', '/');
        if (normalized.startsWith("./")) {
            normalized = normalized.substring(2);
        }
        if (normalized.startsWith("outputs/")) {
            Path underAi = aiServiceConfig.getOutputPath()
                    .resolve(normalized.substring("outputs/".length()));
            if (Files.exists(underAi)) {
                return underAi.normalize();
            }
        }

        Path bySession = aiServiceConfig.getOutputPath()
                .resolve("preprocess")
                .resolve(sessionId)
                .resolve("gem_flat.png");
        if (Files.exists(bySession)) {
            return bySession.normalize();
        }
        bySession = aiServiceConfig.getOutputPath()
                .resolve("preprocess")
                .resolve(sessionId)
                .resolve("no_bg.png");
        if (Files.exists(bySession)) {
            return bySession.normalize();
        }
        return direct;
    }

    private static String resolveImageExt(String filename) {
        if (filename == null || !filename.contains(".")) {
            return ".png";
        }
        String ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
        return switch (ext) {
            case ".jpg", ".jpeg", ".png", ".bmp", ".webp" -> ext;
            default -> ".png";
        };
    }

    private static void saveMultipartFile(MultipartFile file, Path destination) throws IOException {
        Path parent = destination.getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }
        try (InputStream inputStream = file.getInputStream()) {
            Files.copy(inputStream, destination, StandardCopyOption.REPLACE_EXISTING);
        }
    }
}
