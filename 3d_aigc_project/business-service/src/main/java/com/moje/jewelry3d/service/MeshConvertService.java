package com.moje.jewelry3d.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.config.AiServiceConfig;
import com.moje.jewelry3d.config.FileStorageConfig;
import com.moje.jewelry3d.model.dto.MeshConvertResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * 3D 网格格式转换业务
 */
@Slf4j
@Service
public class MeshConvertService {

    private static final Set<String> SUPPORTED_FORMATS = Set.of("obj", "glb", "stl");

    private final AiServiceClient aiServiceClient;
    private final AiServiceConfig aiServiceConfig;
    private final FileStorageConfig fileStorageConfig;

    @Autowired
    public MeshConvertService(
            AiServiceClient aiServiceClient,
            AiServiceConfig aiServiceConfig,
            FileStorageConfig fileStorageConfig
    ) {
        this.aiServiceClient = aiServiceClient;
        this.aiServiceConfig = aiServiceConfig;
        this.fileStorageConfig = fileStorageConfig;
    }

    public MeshConvertResponse convert(MultipartFile file, String outputFormat) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("请上传 3D 模型文件");
        }

        String sourceExt = resolveMeshExt(file.getOriginalFilename());
        String targetFmt = normalizeFormat(outputFormat);

        if (sourceExt.equals(targetFmt)) {
            throw new BusinessException("源格式与目标格式相同，无需转换");
        }

        String sessionId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        Path sessionDir = fileStorageConfig.getUploadPath().resolve("mesh-convert").resolve(sessionId);

        try {
            Files.createDirectories(sessionDir);
            Path inputPath = sessionDir.resolve("input." + sourceExt);
            saveMultipartFile(file, inputPath);

            Path aiOutputPath = aiServiceConfig.getOutputPath()
                    .resolve("mesh-convert")
                    .resolve(sessionId)
                    .resolve("converted." + targetFmt);

            JsonNode aiResult = aiServiceClient.callMeshConvert(
                    inputPath.toString(),
                    aiOutputPath.toString(),
                    targetFmt,
                    sessionId
            );

            if (!aiResult.path("success").asBoolean(false)) {
                throw new BusinessException("AI 格式转换失败");
            }

            String aiOut = aiResult.path("output_path").asText(null);
            Path sourceOutput = resolveAiOutputPath(aiOut, sessionId, targetFmt);
            if (sourceOutput == null || !Files.exists(sourceOutput)) {
                throw new BusinessException("转换结果文件未生成，请检查 AI 服务");
            }

            Path localOutput = sessionDir.resolve("converted." + targetFmt);
            Files.copy(sourceOutput, localOutput, StandardCopyOption.REPLACE_EXISTING);

            MeshConvertResponse response = new MeshConvertResponse();
            response.setSessionId(sessionId);
            response.setSourceFormat(sourceExt.toUpperCase(Locale.ROOT));
            response.setOutputFormat(targetFmt.toUpperCase(Locale.ROOT));
            response.setOriginalFilename(file.getOriginalFilename());
            response.setFileSize(Files.size(localOutput));
            response.setVertexCount(aiResult.path("vertex_count").asInt(0));
            response.setFaceCount(aiResult.path("face_count").asInt(0));
            response.setDownloadUrl("/mesh/convert/" + sessionId + "/download");
            response.setPreviewUrl("/mesh/convert/" + sessionId + "/preview");
            return response;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("网格格式转换失败", e);
            throw new BusinessException("格式转换失败: " + e.getMessage(), e);
        }
    }

    public Path getConvertedFile(String sessionId) {
        validateSessionId(sessionId);
        Path dir = fileStorageConfig.getUploadPath().resolve("mesh-convert").resolve(sessionId);
        for (String fmt : SUPPORTED_FORMATS) {
            Path file = dir.resolve("converted." + fmt);
            if (Files.exists(file)) {
                return file;
            }
        }
        throw new BusinessException(404, "转换结果不存在: " + sessionId);
    }

    public String getConvertedContentType(String sessionId) {
        Path file = getConvertedFile(sessionId);
        String ext = getExtension(file.getFileName().toString());
        return switch (ext) {
            case "glb" -> "model/gltf-binary";
            case "obj" -> "model/obj";
            case "stl" -> "model/stl";
            default -> "application/octet-stream";
        };
    }

    private Path resolveAiOutputPath(String aiPath, String sessionId, String targetFmt) {
        if (aiPath != null && !aiPath.isBlank()) {
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
        }

        Path fallback = aiServiceConfig.getOutputPath()
                .resolve("mesh-convert")
                .resolve(sessionId)
                .resolve("converted." + targetFmt);
        return Files.exists(fallback) ? fallback.normalize() : null;
    }

    private static String normalizeFormat(String format) {
        if (format == null || format.isBlank()) {
            throw new BusinessException("请选择目标格式");
        }
        String fmt = format.trim().toLowerCase(Locale.ROOT).replace(".", "");
        if (!SUPPORTED_FORMATS.contains(fmt)) {
            throw new BusinessException("不支持的目标格式: " + format + "，支持 OBJ/GLB/STL");
        }
        return fmt;
    }

    private static String resolveMeshExt(String filename) {
        if (filename == null || !filename.contains(".")) {
            throw new BusinessException("无法识别文件格式，请上传 OBJ/GLB/STL 文件");
        }
        String ext = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        if (!SUPPORTED_FORMATS.contains(ext)) {
            throw new BusinessException("不支持的源格式: ." + ext + "，支持 OBJ/GLB/STL");
        }
        return ext;
    }

    private static String getExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot + 1).toLowerCase(Locale.ROOT) : "";
    }

    private static void validateSessionId(String sessionId) {
        if (sessionId == null || sessionId.isBlank() || !sessionId.matches("[a-f0-9]{16}")) {
            throw new BusinessException(400, "无效的会话 ID");
        }
    }

    private static void saveMultipartFile(MultipartFile file, Path destination) throws IOException {
        Path parent = destination.getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }
        try (var in = file.getInputStream()) {
            Files.copy(in, destination, StandardCopyOption.REPLACE_EXISTING);
        }
    }
}
