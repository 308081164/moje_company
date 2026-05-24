package com.moje.jewelry3d.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.config.AiServiceConfig;
import com.moje.jewelry3d.model.dto.SystemInfo;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.io.File;
import java.util.Map;

/**
 * AI推理服务HTTP客户端
 * 封装与Python AI推理服务的所有HTTP通信
 */
@Slf4j
@Service
public class AiServiceClient {

    private final AiServiceConfig aiServiceConfig;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Autowired
    public AiServiceClient(AiServiceConfig aiServiceConfig) {
        this.aiServiceConfig = aiServiceConfig;
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    /**
     * 获取AI服务基础URL
     */
    private String getBaseUrl() {
        return aiServiceConfig.getBaseUrl();
    }

    /**
     * 调用AI服务的图片转3D接口
     *
     * @param imageFile 上传的设计图文件
     * @return AI服务返回的响应JSON
     */
    public JsonNode callImageTo3d(File imageFile) {
        String url = getBaseUrl() + "/api/generate/image-to-3d";
        return callGenerateApi(url, imageFile, null, null);
    }

    /**
     * 调用AI服务的条件生成接口
     *
     * @param imageFile               上传的设计图文件
     * @param inlayStructureFile      镶嵌底座文件（可选）
     * @param inlayStructureFilename  镶嵌底座文件名（可选）
     * @return AI服务返回的响应JSON
     */
    public JsonNode callConditionGenerate(File imageFile, File inlayStructureFile, String inlayStructureFilename) {
        String url = getBaseUrl() + "/api/generate/condition-generate";
        return callGenerateApi(url, imageFile, inlayStructureFile, inlayStructureFilename);
    }

    /**
     * 通用生成API调用方法
     *
     * @param url                     请求URL
     * @param imageFile               设计图文件
     * @param inlayStructureFile      镶嵌底座文件（可选）
     * @param inlayStructureFilename  镶嵌底座文件名（可选）
     * @return AI服务返回的JSON响应
     */
    private JsonNode callGenerateApi(String url, File imageFile, File inlayStructureFile, String inlayStructureFilename) {
        try {
            // 构建multipart请求体
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("image", new FileSystemResource(imageFile));

            if (inlayStructureFile != null && inlayStructureFile.exists()) {
                body.add("inlay_structure", new FileSystemResource(inlayStructureFile));
            } else if (inlayStructureFilename != null && !inlayStructureFilename.isEmpty()) {
                // 传递镶嵌底座文件名，由AI服务自行查找
                body.add("inlay_structure_filename", inlayStructureFilename);
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            log.info("调用AI服务: {}", url);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, requestEntity, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return objectMapper.readTree(response.getBody());
            } else {
                throw new BusinessException("AI服务调用失败: HTTP " + response.getStatusCode());
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("调用AI服务异常: {}", url, e);
            throw new BusinessException("AI服务调用异常: " + e.getMessage(), e);
        }
    }

    /**
     * 查询生成任务状态
     *
     * @param taskId 任务ID
     * @return AI服务返回的任务状态JSON
     */
    public JsonNode getTaskStatus(String taskId) {
        String url = getBaseUrl() + "/api/generate/tasks/" + taskId;
        return doGet(url);
    }

    /**
     * 获取系统信息（从AI服务获取GPU信息等）
     *
     * @return 系统信息JSON
     */
    public JsonNode getSystemInfo() {
        String url = getBaseUrl() + "/api/system/info";
        return doGet(url);
    }

    /**
     * 健康检查
     *
     * @return AI服务是否可用
     */
    public boolean isHealthy() {
        try {
            String url = getBaseUrl() + "/api/system/health";
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            log.warn("AI服务健康检查失败: {}", e.getMessage());
            return false;
        }
    }

    /**
     * 通用GET请求
     */
    private JsonNode doGet(String url) {
        try {
            log.info("调用AI服务GET: {}", url);
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return objectMapper.readTree(response.getBody());
            } else {
                throw new BusinessException("AI服务调用失败: HTTP " + response.getStatusCode());
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("调用AI服务异常: {}", url, e);
            throw new BusinessException("AI服务调用异常: " + e.getMessage(), e);
        }
    }
}
