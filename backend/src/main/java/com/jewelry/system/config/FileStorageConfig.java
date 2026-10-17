package com.jewelry.system.config;

import jakarta.annotation.PostConstruct;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.nio.file.Files;
import java.nio.file.Paths;

/**
 * 主项目对象存储配置（MinIO / 本地 filesystem 降级）。
 * 统一 URL 入口由 publicBaseUrl 决定，后续接入 CDN 仅需修改该配置。
 */
@Slf4j
@Data
@Configuration
@ConfigurationProperties(prefix = "app.storage")
public class FileStorageConfig {

    /** local | minio，默认 local（本地磁盘兜底，无需外部依赖即可跑通上传链路） */
    private String mode = "local";
    private String localRoot = "uploads/jewelry";
    private String endpoint = "http://localhost:9000";
    private String accessKey = "minioadmin";
    private String secretKey = "minioadmin";
    private String bucket = "jewelry";
    /** 对外访问基础 URL；接入 CDN 后改为 CDN 域名（如 https://cdn.example.com） */
    private String publicBaseUrl = "http://localhost:9000";

    @PostConstruct
    void init() {
        try {
            if (!isMinioEnabled()) {
                Files.createDirectories(Paths.get(localRoot).toAbsolutePath().normalize());
            }
            log.info("文件存储 mode={}, bucket={}, publicBaseUrl={}", mode, bucket, publicBaseUrl);
        } catch (Exception e) {
            log.warn("创建本地存储目录失败", e);
        }
    }

    public boolean isMinioEnabled() {
        return "minio".equalsIgnoreCase(mode);
    }

    public String normalizedPublicBaseUrl() {
        if (publicBaseUrl == null || publicBaseUrl.isBlank()) {
            return "";
        }
        return publicBaseUrl.strip().replaceAll("/+$", "");
    }
}
