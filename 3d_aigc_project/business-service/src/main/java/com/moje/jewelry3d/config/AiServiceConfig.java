package com.moje.jewelry3d.config;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * AI推理服务地址与输出目录配置
 */
@Slf4j
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "ai-service")
public class AiServiceConfig {

    /** AI推理服务基础URL */
    private String baseUrl = "http://localhost:8855";

    /** AI 服务本地输出目录（相对路径基于 business-service 启动目录） */
    private String outputDir = "../ai-service/outputs";

    private Path outputPath;

    @PostConstruct
    public void init() {
        Path path = Paths.get(outputDir);
        if (!path.isAbsolute()) {
            path = Paths.get(System.getProperty("user.dir")).resolve(path);
        }
        outputPath = path.toAbsolutePath().normalize();
        log.info("AI 输出目录: {}", outputPath);
    }
}
