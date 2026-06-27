package com.moje.jewelry3d.config;

import jakarta.annotation.PostConstruct;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 上传与输出目录配置（启动时解析为绝对路径，避免 Tomcat 临时目录导致路径错误）
 */
@Slf4j
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "file")
public class FileStorageConfig {

    private String uploadDir = "./uploads";
    private String outputDir = "./outputs";

    private Path uploadPath;
    private Path outputPath;

    @PostConstruct
    public void init() throws IOException {
        uploadPath = resolveToAbsolute(uploadDir);
        outputPath = resolveToAbsolute(outputDir);
        Files.createDirectories(uploadPath);
        Files.createDirectories(outputPath);
        log.info("文件存储目录就绪 upload={} output={}", uploadPath, outputPath);
    }

    private static Path resolveToAbsolute(String configured) {
        Path path = Paths.get(configured);
        if (path.isAbsolute()) {
            return path.normalize();
        }
        return Paths.get(System.getProperty("user.dir")).resolve(path).toAbsolutePath().normalize();
    }
}
