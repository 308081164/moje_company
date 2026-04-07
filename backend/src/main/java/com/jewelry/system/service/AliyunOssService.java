package com.jewelry.system.service;

import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@Service
@Slf4j
public class AliyunOssService {

    @Value("${aliyun.oss.endpoint:}")
    private String endpoint;

    @Value("${aliyun.oss.access-key-id:}")
    private String accessKeyId;

    @Value("${aliyun.oss.access-key-secret:}")
    private String accessKeySecret;

    @Value("${aliyun.oss.bucket-name:}")
    private String bucketName;

    /**
     * 是否已正确配置 OSS（配置缺失则自动禁用，继续使用本地存储）。
     */
    public boolean isEnabled() {
        return notBlank(endpoint) && notBlank(accessKeyId) && notBlank(accessKeySecret) && notBlank(bucketName);
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    /**
     * 上传文件到 OSS，返回可访问 URL；如配置不完整或上传失败，抛出异常，由上层处理。
     */
    public String uploadObject(String objectKey, MultipartFile file) throws IOException {
        if (!isEnabled()) {
            throw new IllegalStateException("Aliyun OSS 未正确配置，无法上传文件");
        }
        OSS ossClient = null;
        try {
            ossClient = new OSSClientBuilder().build(endpoint, accessKeyId, accessKeySecret);
            ossClient.putObject(bucketName, objectKey, file.getInputStream());
            // 生成 HTTPS 访问地址（公共读桶时可直接访问）
            return "https://" + bucketName + "." + endpoint + "/" + objectKey;
        } catch (IOException e) {
            log.error("OSS upload failed. key={}", objectKey, e);
            throw e;
        } catch (Exception e) {
            log.error("OSS client error. key={}", objectKey, e);
            throw new IllegalStateException("OSS 上传失败", e);
        } finally {
            if (ossClient != null) {
                ossClient.shutdown();
            }
        }
    }

    /**
     * 根据对象 key 删除 OSS 上的文件，失败会记录日志但不抛出异常。
     */
    public void deleteObject(String objectKey) {
        if (!isEnabled() || objectKey == null || objectKey.isBlank()) {
            return;
        }
        OSS ossClient = null;
        try {
            ossClient = new OSSClientBuilder().build(endpoint, accessKeyId, accessKeySecret);
            ossClient.deleteObject(bucketName, objectKey);
        } catch (Exception e) {
            log.warn("OSS delete failed. key={}", objectKey, e);
        } finally {
            if (ossClient != null) {
                ossClient.shutdown();
            }
        }
    }
}

