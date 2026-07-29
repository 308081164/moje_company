package com.moje.jewelry3d.config;

import jakarta.annotation.PostConstruct;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.nio.file.Files;
import java.nio.file.Paths;

/**
 * 3D 生成任务对象存储配置（MinIO / 本地降级，与 inlay-v2 模式一致）
 */
@Slf4j
@Data
@Configuration
@ConfigurationProperties(prefix = "generate.storage")
public class GenerateStorageConfig {

    /** minio | local */
    private String mode = "local";
    private String localRoot = "uploads/generate-storage";
    private String endpoint = "http://localhost:9000";
    private String accessKey = "minioadmin";
    private String secretKey = "minioadmin";
    private String inputBucket = "generate-input";
    private String outputBucket = "generate-output";

    @PostConstruct
    void init() {
        try {
            if (!isMinioEnabled()) {
                Files.createDirectories(Paths.get(localRoot).toAbsolutePath().normalize());
            }
            log.info("Generate storage mode={}", mode);
        } catch (Exception e) {
            log.warn("创建 generate storage 目录失败", e);
        }
    }

    public boolean isMinioEnabled() {
        return "minio".equalsIgnoreCase(mode);
    }
}
