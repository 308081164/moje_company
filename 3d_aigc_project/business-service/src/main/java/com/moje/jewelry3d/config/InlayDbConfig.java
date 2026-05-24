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
 * 镶嵌结构数据库路径配置
 * 从 application.yml 中读取 inlay-db.path 配置项
 */
@Slf4j
@Data
@Configuration
@ConfigurationProperties(prefix = "inlay-db")
public class InlayDbConfig {

    /** 镶嵌结构数据库根目录路径 */
    private String path = "../镶嵌结构数据库";

    /**
     * 初始化时检查并创建目录（如果不存在）
     */
    @PostConstruct
    public void init() {
        Path dbPath = Paths.get(path).toAbsolutePath().normalize();
        if (!Files.exists(dbPath)) {
            try {
                Files.createDirectories(dbPath);
                log.info("镶嵌结构数据库目录已创建: {}", dbPath);
            } catch (Exception e) {
                log.warn("无法创建镶嵌结构数据库目录: {}", dbPath, e);
            }
        } else {
            log.info("镶嵌结构数据库目录: {}", dbPath);
        }
    }
}
