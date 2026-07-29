package com.moje.jewelry3d.config;

import jakarta.annotation.PostConstruct;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 镶嵌库 v2 配置（PostgreSQL + MinIO / 本地降级）
 */
@Slf4j
@Data
@Configuration
@ConfigurationProperties(prefix = "inlay-v2")
public class InlayV2Config {

    /** 是否启用 v2 API */
    private boolean enabled = true;

    /** 迁移期：v1 查不到时回退旧目录扫描（解耦后应为 false） */
    private boolean legacyFallback = false;

    /** 是否启用 v1 内存索引（解耦后应为 false） */
    private boolean v1IndexEnabled = false;

    /** 融合管线 mesh 本地缓存目录 */
    private String cacheDir = "uploads/inlay_cache";

    /** Phase 2：是否允许 JCD 源文件上传（MVP 可设为 false） */
    private boolean meshCropJcdEnabled = true;

    private Storage storage = new Storage();
    private Queue queue = new Queue();
    private Cache cache = new Cache();

    @PostConstruct
    void init() {
        try {
            Files.createDirectories(Paths.get(cacheDir).toAbsolutePath().normalize());
            if (!storage.isMinioEnabled()) {
                Files.createDirectories(Paths.get(storage.getLocalRoot()).toAbsolutePath().normalize());
            }
            log.info("Inlay v2 enabled={}, minio={}, queue={}",
                    enabled, storage.isMinioEnabled(), queue.getType());
        } catch (Exception e) {
            log.warn("创建 inlay v2 目录失败", e);
        }
    }

    @Data
    public static class Storage {
        /** minio | local */
        private String mode = "local";
        private String localRoot = "uploads/inlay-storage";
        private String endpoint = "http://localhost:9000";
        private String accessKey = "minioadmin";
        private String secretKey = "minioadmin";
        private String sourceBucket = "inlay-source";
        private String meshBucket = "inlay-mesh";
        private String previewBucket = "inlay-preview";

        public boolean isMinioEnabled() {
            return "minio".equalsIgnoreCase(mode);
        }
    }

    @Data
    public static class Queue {
        /** memory | redis */
        private String type = "memory";
        private int workerThreads = 2;
    }

    @Data
    public static class Cache {
        /** 缩略图 Cache-Control max-age（秒） */
        private long thumbnailMaxAge = 86400L;
        /** mesh 下载 Cache-Control max-age（秒） */
        private long meshMaxAge = 3600L;
        /** 是否启用 immutable 缓存头 */
        private boolean immutableThumbnails = true;
    }
}
