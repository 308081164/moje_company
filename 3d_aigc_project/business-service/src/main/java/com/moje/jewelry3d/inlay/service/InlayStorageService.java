package com.moje.jewelry3d.inlay.service;

import com.moje.jewelry3d.config.InlayV2Config;
import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.StatObjectArgs;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Optional;

/**
 * 对象存储抽象：MinIO 或本地 filesystem 降级
 */
@Slf4j
@Service
public class InlayStorageService {

    private final InlayV2Config config;
    private final MinioClient minioClient;

    public InlayStorageService(InlayV2Config config) {
        this.config = config;
        this.minioClient = config.getStorage().isMinioEnabled()
                ? MinioClient.builder()
                    .endpoint(config.getStorage().getEndpoint())
                    .credentials(config.getStorage().getAccessKey(), config.getStorage().getSecretKey())
                    .build()
                : null;
        ensureBuckets();
    }

    private void ensureBuckets() {
        if (minioClient == null) return;
        for (String bucket : new String[]{
                config.getStorage().getSourceBucket(),
                config.getStorage().getMeshBucket(),
                config.getStorage().getPreviewBucket()
        }) {
            try {
                if (!minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
                    minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
                    log.info("Created MinIO bucket: {}", bucket);
                }
            } catch (Exception e) {
                log.warn("MinIO bucket check failed for {}: {}", bucket, e.getMessage());
            }
        }
    }

    public void putObject(String bucket, String key, InputStream stream, long size, String contentType) {
        if (minioClient != null) {
            try {
                minioClient.putObject(PutObjectArgs.builder()
                        .bucket(bucket)
                        .object(key)
                        .stream(stream, size, -1)
                        .contentType(contentType)
                        .build());
                return;
            } catch (Exception e) {
                throw new RuntimeException("MinIO upload failed: " + key, e);
            }
        }
        Path target = localPath(bucket, key);
        try {
            Files.createDirectories(target.getParent());
            Files.copy(stream, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (Exception e) {
            throw new RuntimeException("Local storage upload failed: " + key, e);
        }
    }

    public Optional<InputStream> getObject(String bucket, String key) {
        if (minioClient != null) {
            try {
                return Optional.of(minioClient.getObject(GetObjectArgs.builder().bucket(bucket).object(key).build()));
            } catch (Exception e) {
                log.debug("MinIO getObject miss: {}/{}", bucket, key);
                return Optional.empty();
            }
        }
        Path path = localPath(bucket, key);
        if (!Files.isRegularFile(path)) return Optional.empty();
        try {
            return Optional.of(Files.newInputStream(path));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public Optional<Path> resolveLocalPath(String bucket, String key) {
        if (minioClient != null) return Optional.empty();
        Path path = localPath(bucket, key);
        return Files.isRegularFile(path) ? Optional.of(path) : Optional.empty();
    }

    /**
     * 返回本地可读路径：local 模式直接返回；MinIO 模式下载到 cache 后返回。
     */
    public Optional<Path> materializeLocal(String bucket, String key) {
        Optional<Path> local = resolveLocalPath(bucket, key);
        if (local.isPresent()) {
            return local;
        }
        if (minioClient == null) {
            return Optional.empty();
        }
        Path cachePath = Paths.get(config.getStorage().getLocalRoot(), "_cache", bucket, key).toAbsolutePath().normalize();
        if (Files.isRegularFile(cachePath)) {
            return Optional.of(cachePath);
        }
        Optional<InputStream> stream = getObject(bucket, key);
        if (stream.isEmpty()) {
            return Optional.empty();
        }
        try (InputStream in = stream.get()) {
            Files.createDirectories(cachePath.getParent());
            Files.copy(in, cachePath, StandardCopyOption.REPLACE_EXISTING);
            return Optional.of(cachePath);
        } catch (Exception e) {
            log.debug("materializeLocal failed {}/{}: {}", bucket, key, e.getMessage());
            return Optional.empty();
        }
    }

    public void deleteObject(String bucket, String key) {
        if (key == null || key.isBlank() || key.startsWith("legacy:")) {
            return;
        }
        if (minioClient != null) {
            try {
                minioClient.removeObject(RemoveObjectArgs.builder().bucket(bucket).object(key).build());
            } catch (Exception e) {
                log.warn("MinIO 删除失败 {}/{}: {}", bucket, key, e.getMessage());
            }
            return;
        }
        try {
            Files.deleteIfExists(localPath(bucket, key));
        } catch (Exception e) {
            log.warn("本地删除失败 {}/{}: {}", bucket, key, e.getMessage());
        }
    }

    public boolean exists(String bucket, String key) {
        if (minioClient != null) {
            try {
                minioClient.statObject(StatObjectArgs.builder().bucket(bucket).object(key).build());
                return true;
            } catch (Exception e) {
                return false;
            }
        }
        return Files.isRegularFile(localPath(bucket, key));
    }

    public Path localPath(String bucket, String key) {
        return Paths.get(config.getStorage().getLocalRoot(), bucket, key).toAbsolutePath().normalize();
    }

    public String previewBucket() {
        return config.getStorage().getPreviewBucket();
    }

    public String meshBucket() {
        return config.getStorage().getMeshBucket();
    }

    public String sourceBucket() {
        return config.getStorage().getSourceBucket();
    }
}
