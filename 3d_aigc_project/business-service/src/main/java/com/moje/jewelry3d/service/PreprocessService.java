package com.moje.jewelry3d.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.config.AiServiceConfig;
import com.moje.jewelry3d.config.FileStorageConfig;
import com.moje.jewelry3d.model.dto.PreprocessResponse;
import com.moje.jewelry3d.model.dto.SplitMultiViewResponse;
import com.moje.jewelry3d.model.dto.ViewCropDto;
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

    @Autowired
    public PreprocessService(
            AiServiceClient aiServiceClient,
            AiServiceConfig aiServiceConfig,
            FileStorageConfig fileStorageConfig
    ) {
        this.aiServiceClient = aiServiceClient;
        this.aiServiceConfig = aiServiceConfig;
        this.fileStorageConfig = fileStorageConfig;
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
        Path file = fileStorageConfig.getUploadPath()
                .resolve("preprocess")
                .resolve(sessionId)
                .resolve("no_bg.png");
        if (!Files.exists(file)) {
            throw new BusinessException(404, "预处理预览不存在: " + sessionId);
        }
        return file;
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
