package com.moje.jewelry3d.service;

import com.moje.jewelry3d.config.GenerateStorageConfig;
import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.ListObjectsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.Result;
import io.minio.StatObjectArgs;
import io.minio.messages.Item;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Comparator;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * 生成任务对象存储：MinIO 或本地 filesystem 降级
 */
@Slf4j
@Service
public class GenerateStorageService {

    private final GenerateStorageConfig config;
    private final MinioClient minioClient;

    public GenerateStorageService(GenerateStorageConfig config) {
        this.config = config;
        this.minioClient = config.isMinioEnabled()
                ? MinioClient.builder()
                    .endpoint(config.getEndpoint())
                    .credentials(config.getAccessKey(), config.getSecretKey())
                    .build()
                : null;
        ensureBuckets();
    }

    private void ensureBuckets() {
        if (minioClient == null) {
            return;
        }
        for (String bucket : new String[]{config.getInputBucket(), config.getOutputBucket()}) {
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
                throw new RuntimeException("MinIO 上传失败: " + key, e);
            }
        }
        Path target = localPath(bucket, key);
        try {
            Files.createDirectories(target.getParent());
            Files.copy(stream, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (Exception e) {
            throw new RuntimeException("本地存储上传失败: " + key, e);
        }
    }

    public void putFile(String bucket, String key, Path source, String contentType) {
        try (InputStream in = Files.newInputStream(source)) {
            putObject(bucket, key, in, Files.size(source), contentType);
        } catch (Exception e) {
            throw new RuntimeException("上传文件失败: " + key, e);
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
        if (!Files.isRegularFile(path)) {
            return Optional.empty();
        }
        try {
            return Optional.of(Files.newInputStream(path));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public Optional<Path> resolveLocalPath(String bucket, String key) {
        if (minioClient != null) {
            return Optional.empty();
        }
        Path path = localPath(bucket, key);
        return Files.isRegularFile(path) ? Optional.of(path) : Optional.empty();
    }

    public Optional<Path> materializeLocal(String bucket, String key) {
        Optional<Path> local = resolveLocalPath(bucket, key);
        if (local.isPresent()) {
            return local;
        }
        if (minioClient == null) {
            return Optional.empty();
        }
        Path cachePath = Paths.get(config.getLocalRoot(), "_cache", bucket, key).toAbsolutePath().normalize();
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

    public void deleteObject(String bucket, String key) {
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

    /** 按 key 前缀永久删除对象（含 MinIO 与本地 filesystem 降级目录） */
    public void deleteObjectsByPrefix(String bucket, String prefix) {
        String normalizedPrefix = prefix.endsWith("/") ? prefix : prefix + "/";
        if (minioClient != null) {
            try {
                Iterable<Result<Item>> results = minioClient.listObjects(
                        ListObjectsArgs.builder()
                                .bucket(bucket)
                                .prefix(normalizedPrefix)
                                .recursive(true)
                                .build());
                for (Result<Item> result : results) {
                    Item item = result.get();
                    deleteObject(bucket, item.objectName());
                }
            } catch (Exception e) {
                log.warn("MinIO 前缀删除失败 {}/{}: {}", bucket, normalizedPrefix, e.getMessage());
            }
            return;
        }
        Path prefixDir = Paths.get(config.getLocalRoot(), bucket, normalizedPrefix.replaceAll("/$", ""))
                .toAbsolutePath()
                .normalize();
        deleteDirectoryQuietly(prefixDir);
    }

    private static void deleteDirectoryQuietly(Path path) {
        if (!Files.exists(path)) {
            return;
        }
        try (Stream<Path> walk = Files.walk(path)) {
            walk.sorted(Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException ignored) {
                }
            });
        } catch (IOException e) {
            log.warn("本地前缀目录删除失败 {}: {}", path, e.getMessage());
        }
    }

    public Path localPath(String bucket, String key) {
        return Paths.get(config.getLocalRoot(), bucket, key).toAbsolutePath().normalize();
    }

    public String inputBucket() {
        return config.getInputBucket();
    }

    public String outputBucket() {
        return config.getOutputBucket();
    }
}
