package com.jewelry.system.service;

import com.jewelry.system.config.FileStorageConfig;
import com.jewelry.system.util.ImageUploadSupport;
import com.jewelry.system.util.ImageUploadSupport.NormalizedUpload;
import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.StatObjectArgs;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

/**
 * 主项目统一对象存储：MinIO（S3 兼容）或本地 filesystem 降级。
 * 方法签名对齐旧的 AliyunOssService，调用点改动最小；
 * publicUrl 为统一 URL 入口，接入 CDN 仅需调整 FileStorageConfig.publicBaseUrl。
 */
@Slf4j
@Service
public class MinioStorageService {

    private final FileStorageConfig config;
    private final MinioClient minioClient;

    public MinioStorageService(FileStorageConfig config) {
        this.config = config;
        this.minioClient = config.isMinioEnabled()
                ? MinioClient.builder()
                    .endpoint(config.getEndpoint())
                    .credentials(config.getAccessKey(), config.getSecretKey())
                    .build()
                : null;
        ensureBucket();
    }

    private void ensureBucket() {
        if (minioClient == null) {
            return;
        }
        try {
            if (!minioClient.bucketExists(BucketExistsArgs.builder().bucket(config.getBucket()).build())) {
                minioClient.makeBucket(MakeBucketArgs.builder().bucket(config.getBucket()).build());
                log.info("Created MinIO bucket: {}", config.getBucket());
            }
        } catch (Exception e) {
            log.warn("MinIO bucket check failed for {}: {}", config.getBucket(), e.getMessage());
        }
    }

    /** 本地降级下始终可用；保留此方法以兼容旧调用点语义。 */
    public boolean isEnabled() {
        return true;
    }

    public String uploadObject(String objectKey, MultipartFile file) throws IOException {
        NormalizedUpload normalized = ImageUploadSupport.normalizeRasterUpload(file);
        MultipartFile uploadFile = normalized.file();
        String key = normalized.convertedFromBmp()
                ? ImageUploadSupport.replaceBmpExtensionInKey(objectKey)
                : objectKey;
        if (minioClient != null) {
            try {
                minioClient.putObject(PutObjectArgs.builder()
                        .bucket(config.getBucket())
                        .object(key)
                        .stream(uploadFile.getInputStream(), uploadFile.getSize(), -1)
                        .contentType(uploadFile.getContentType() != null && !uploadFile.getContentType().isBlank()
                                ? uploadFile.getContentType() : "application/octet-stream")
                        .build());
                return publicUrl(key);
            } catch (Exception e) {
                log.error("MinIO upload failed. key={}", key, e);
                throw new IOException("MinIO 上传失败: " + key, e);
            }
        }
        Path target = localPath(key);
        try {
            Files.createDirectories(target.getParent());
            try (InputStream in = uploadFile.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
            return publicUrl(key);
        } catch (Exception e) {
            log.error("本地存储上传失败. key={}", key, e);
            throw new IOException("本地存储上传失败: " + key, e);
        }
    }

    public byte[] readObjectBytes(String objectKey) throws IOException {
        if (minioClient != null) {
            try (InputStream in = minioClient.getObject(GetObjectArgs.builder()
                    .bucket(config.getBucket()).object(objectKey).build())) {
                return in.readAllBytes();
            } catch (Exception e) {
                log.error("MinIO readObjectBytes failed. key={}", objectKey, e);
                throw new IOException("MinIO 读取失败: " + objectKey, e);
            }
        }
        Path path = localPath(objectKey);
        if (!Files.isRegularFile(path)) {
            throw new IOException("本地文件不存在: " + objectKey);
        }
        return Files.readAllBytes(path);
    }

    public void deleteObject(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return;
        }
        if (minioClient != null) {
            try {
                minioClient.removeObject(RemoveObjectArgs.builder()
                        .bucket(config.getBucket()).object(objectKey).build());
            } catch (Exception e) {
                log.warn("MinIO 删除失败 {}: {}", objectKey, e.getMessage());
            }
            return;
        }
        try {
            Files.deleteIfExists(localPath(objectKey));
        } catch (Exception e) {
            log.warn("本地删除失败 {}: {}", objectKey, e.getMessage());
        }
    }

    public void copyObject(String sourceKey, String destKey) {
        if (sourceKey == null || sourceKey.isBlank() || destKey == null || destKey.isBlank()) {
            return;
        }
        if (minioClient != null) {
            try (InputStream in = minioClient.getObject(GetObjectArgs.builder()
                    .bucket(config.getBucket()).object(sourceKey).build())) {
                minioClient.putObject(PutObjectArgs.builder()
                        .bucket(config.getBucket()).object(destKey)
                        .stream(in, -1, 5 * 1024 * 1024 * 1024L)
                        .build());
            } catch (Exception e) {
                log.error("MinIO copyObject failed. {} -> {}", sourceKey, destKey, e);
                throw new RuntimeException("MinIO 复制失败: " + sourceKey, e);
            }
            return;
        }
        Path src = localPath(sourceKey);
        Path dst = localPath(destKey);
        try {
            if (!Files.isRegularFile(src)) {
                throw new IOException("源文件不存在: " + sourceKey);
            }
            Files.createDirectories(dst.getParent());
            Files.copy(src, dst, StandardCopyOption.REPLACE_EXISTING);
        } catch (Exception e) {
            log.error("本地复制失败. {} -> {}", sourceKey, destKey, e);
            throw new RuntimeException("本地复制失败: " + sourceKey, e);
        }
    }

    public boolean objectExists(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return false;
        }
        if (minioClient != null) {
            try {
                minioClient.statObject(StatObjectArgs.builder()
                        .bucket(config.getBucket()).object(objectKey).build());
                return true;
            } catch (Exception e) {
                return false;
            }
        }
        return Files.isRegularFile(localPath(objectKey));
    }

    /** 统一对外访问 URL 入口。 */
    public String publicUrl(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return "";
        }
        String base = config.normalizedPublicBaseUrl();
        String key = objectKey.startsWith("/") ? objectKey.substring(1) : objectKey;
        if (minioClient == null) {
            return base + "/api/files/by-key/" + key;
        }
        return base + "/" + config.getBucket() + "/" + key;
    }

    /** 从 publicUrl 反解对象 key（用于关联参考图等场景）。 */
    public String resolveObjectKeyFromUrl(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        String trimmed = url.strip();
        String prefix = publicUrl("");
        if (trimmed.startsWith(prefix)) {
            return trimmed.substring(prefix.length());
        }
        int scheme = trimmed.indexOf("://");
        if (scheme > 0) {
            int slash = trimmed.indexOf('/', scheme + 3);
            if (slash >= 0 && slash + 1 < trimmed.length()) {
                return trimmed.substring(slash + 1);
            }
        }
        return null;
    }

    private Path localPath(String key) {
        return Paths.get(config.getLocalRoot(), key).toAbsolutePath().normalize();
    }
}
