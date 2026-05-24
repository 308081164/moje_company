package com.moje.jewelry3d.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * AI推理服务地址配置
 * 从 application.yml 中读取 ai-service.base-url 配置项
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "ai-service")
public class AiServiceConfig {

    /** AI推理服务基础URL */
    private String baseUrl = "http://localhost:8855";
}
