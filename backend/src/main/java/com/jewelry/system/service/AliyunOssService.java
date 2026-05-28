package com.jewelry.system.service;

import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.model.CopyObjectRequest;
import com.aliyun.oss.model.ListObjectsV2Request;
import com.aliyun.oss.model.ListObjectsV2Result;
import com.aliyun.oss.model.OSSObjectSummary;
import com.aliyun.oss.model.ObjectMetadata;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.jewelry.system.util.ImageUploadSupport;
import com.jewelry.system.util.ImageUploadSupport.NormalizedUpload;

import jakarta.annotation.PostConstruct;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Service
public class AliyunOssService {

    private static final Logger log = LoggerFactory.getLogger(AliyunOssService.class);

    @Value("${aliyun.oss.endpoint:}")
    private String endpoint;

    @Value("${aliyun.oss.access-key-id:}")
    private String accessKeyId;

    @Value("${aliyun.oss.access-key-secret:}")
    private String accessKeySecret;

    @Value("${aliyun.oss.bucket-name:}")
    private String bucketName;

    @PostConstruct
    void trimOssProperties() {
        endpoint = trimCfg(endpoint);
        accessKeyId = trimCfg(accessKeyId);
        accessKeySecret = trimCfg(accessKeySecret);
        bucketName = trimCfg(bucketName);
        if (!isEnabled()) {
            log.warn("Aliyun OSS 未启用：请检查 ALIYUN_OSS_ENDPOINT/OSS_ENDPOINT、OSS_ACCESS_KEY_ID、OSS_ACCESS_KEY_SECRET、OSS_BUCKET_NAME/OSS_BUCKET 是否非空（勿含不可见字符）");
        }
    }

    private static String trimCfg(String s) {
        if (s == null) {
            return "";
        }
        String t = s.strip();
        // 去掉首尾引号
        if (t.length() >= 2 && ((t.startsWith("\"") && t.endsWith("\"")) || (t.startsWith("'") && t.endsWith("'")))) {
            t = t.substring(1, t.length() - 1).strip();
        }
        // 去掉行尾误粘贴的 ¤（U+00A4）等
        t = t.replaceAll("\u00A4+$", "").strip();
        return t;
    }
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
        NormalizedUpload normalized = ImageUploadSupport.normalizeRasterUpload(file);
        MultipartFile uploadFile = normalized.file();
        String key = normalized.convertedFromBmp()
                ? ImageUploadSupport.replaceBmpExtensionInKey(objectKey)
                : objectKey;
        OSS ossClient = null;
        try {
            ossClient = new OSSClientBuilder().build(endpoint, accessKeyId, accessKeySecret);
            ObjectMetadata meta = new ObjectMetadata();
            meta.setContentLength(uploadFile.getSize());
            if (uploadFile.getContentType() != null && !uploadFile.getContentType().isBlank()) {
                meta.setContentType(uploadFile.getContentType());
            }
            ossClient.putObject(bucketName, key, uploadFile.getInputStream(), meta);
            return "https://" + bucketName + "." + endpoint + "/" + key;
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
     * 按对象 key 读取 OSS 对象内容到内存（适用于导出等中小文件）。
     */
    public byte[] readObjectBytes(String objectKey) throws IOException {
        if (!isEnabled() || objectKey == null || objectKey.isBlank()) {
            throw new IllegalStateException("OSS 未配置或 key 为空");
        }
        OSS ossClient = new OSSClientBuilder().build(endpoint, accessKeyId, accessKeySecret);
        try {
            try (var ossObj = ossClient.getObject(bucketName, objectKey);
                 var in = ossObj.getObjectContent()) {
                return in.readAllBytes();
            }
        } catch (Exception e) {
            log.error("OSS readObjectBytes failed. key={}", objectKey, e);
            throw new IOException("OSS 读取失败", e);
        } finally {
            ossClient.shutdown();
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

    public String publicUrl(String objectKey) {
        if (!isEnabled() || objectKey == null || objectKey.isBlank()) {
            return "";
        }
        return "https://" + bucketName + "." + endpoint + "/" + objectKey;
    }

    /**
     * 从 {@link #publicUrl} / {@link #uploadObject} 返回的 URL 解析对象 key。
     */
    public String resolveObjectKeyFromUrl(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        String trimmed = url.strip();
        String prefix = "https://" + bucketName + "." + endpoint + "/";
        if (trimmed.startsWith(prefix)) {
            return trimmed.substring(prefix.length());
        }
        int scheme = trimmed.indexOf("://");
        if (scheme > 0) {
            int slash = trimmed.indexOf('/', scheme + 3);
            if (slash >= 0 && slash + 1 < trimmed.length()) {
                return trimmed.substring(slash + 1);
            }
        }
        return null;
    }

    public void putEmptyObject(String objectKey) throws IOException {
        if (!isEnabled()) {
            throw new IllegalStateException("OSS 未配置");
        }
        OSS ossClient = new OSSClientBuilder().build(endpoint, accessKeyId, accessKeySecret);
        try {
            byte[] body = new byte[0];
            ObjectMetadata meta = new ObjectMetadata();
            meta.setContentLength(0);
            ossClient.putObject(bucketName, objectKey, new ByteArrayInputStream(body), meta);
        } finally {
            ossClient.shutdown();
        }
    }

    public void putObjectStream(String objectKey, InputStream in, long contentLength, String contentType) throws IOException {
        if (!isEnabled()) {
            throw new IllegalStateException("OSS 未配置");
        }
        OSS ossClient = new OSSClientBuilder().build(endpoint, accessKeyId, accessKeySecret);
        try {
            ObjectMetadata meta = new ObjectMetadata();
            if (contentLength >= 0) {
                meta.setContentLength(contentLength);
            }
            if (contentType != null && !contentType.isBlank()) {
                meta.setContentType(contentType);
            }
            ossClient.putObject(bucketName, objectKey, in, meta);
        } finally {
            ossClient.shutdown();
        }
    }

    public void copyObject(String sourceKey, String destKey) {
        if (!isEnabled()) {
            throw new IllegalStateException("OSS 未配置");
        }
        OSS ossClient = new OSSClientBuilder().build(endpoint, accessKeyId, accessKeySecret);
        try {
            ossClient.copyObject(new CopyObjectRequest(bucketName, sourceKey, bucketName, destKey));
        } finally {
            ossClient.shutdown();
        }
    }

    public boolean objectExists(String objectKey) {
        if (!isEnabled() || objectKey == null || objectKey.isBlank()) {
            return false;
        }
        OSS ossClient = new OSSClientBuilder().build(endpoint, accessKeyId, accessKeySecret);
        try {
            return ossClient.doesObjectExist(bucketName, objectKey);
        } finally {
            ossClient.shutdown();
        }
    }

    public record OssListResult(List<String> commonPrefixes, List<OssObjectItem> objects) {}

    public record OssObjectItem(String key, long size, String lastModified) {}

    public OssListResult listObjectsV2(String prefix, String delimiter, int maxKeys) {
        if (!isEnabled()) {
            throw new IllegalStateException("OSS 未配置");
        }
        OSS ossClient = new OSSClientBuilder().build(endpoint, accessKeyId, accessKeySecret);
        try {
            ListObjectsV2Request req = new ListObjectsV2Request(bucketName);
            req.setPrefix(prefix);
            if (delimiter != null) {
                req.setDelimiter(delimiter);
            }
            req.setMaxKeys(Math.min(Math.max(maxKeys, 1), 1000));
            ListObjectsV2Result result = ossClient.listObjectsV2(req);
            List<String> prefixes = new ArrayList<>(result.getCommonPrefixes());
            List<OssObjectItem> items = new ArrayList<>();
            for (OSSObjectSummary s : result.getObjectSummaries()) {
                items.add(new OssObjectItem(s.getKey(), s.getSize(), s.getLastModified() != null ? s.getLastModified().toString() : null));
            }
            return new OssListResult(prefixes, items);
        } finally {
            ossClient.shutdown();
        }
    }

    /** 删除指定前缀下所有对象（用于目录树删除） */
    public int deleteObjectsUnderPrefix(String prefix) {
        if (!isEnabled() || prefix == null || prefix.isBlank()) {
            return 0;
        }
        OSS ossClient = new OSSClientBuilder().build(endpoint, accessKeyId, accessKeySecret);
        int deleted = 0;
        try {
            String nextToken = null;
            do {
                ListObjectsV2Request req = new ListObjectsV2Request(bucketName);
                req.setPrefix(prefix);
                req.setMaxKeys(500);
                req.setContinuationToken(nextToken);
                ListObjectsV2Result result = ossClient.listObjectsV2(req);
                for (OSSObjectSummary s : result.getObjectSummaries()) {
                    ossClient.deleteObject(bucketName, s.getKey());
                    deleted++;
                }
                nextToken = result.getNextContinuationToken();
            } while (nextToken != null);
        } finally {
            ossClient.shutdown();
        }
        return deleted;
    }

    /** 目录占位对象 key（零字节），便于在控制台/列表中识别空目录 */
    public String directoryPlaceholderKey(String directoryPrefix) {
        String p = directoryPrefix.endsWith("/") ? directoryPrefix : directoryPrefix + "/";
        return p + ".dir";
    }

    public void ensureDirectoryPlaceholder(String directoryPrefix) throws IOException {
        String key = directoryPlaceholderKey(directoryPrefix);
        if (!objectExists(key)) {
            putEmptyObject(key);
        }
    }
}

