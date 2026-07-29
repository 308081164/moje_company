package com.moje.jewelry3d.service.cloud;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.config.GemRepaintProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Base64;

/**
 * 阿里云 DashScope 通义万相图像编辑客户端（整图指令编辑 description_edit）
 */
@Slf4j
@Component
public class DashScopeRepaintClient {

    private final GemRepaintProperties properties;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    /** 下载 OSS 预签名 URL；RestTemplate 会重编码 query 导致 SignatureDoesNotMatch */
    private final HttpClient httpClient;

    public DashScopeRepaintClient(GemRepaintProperties properties) {
        this.properties = properties;
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
        this.httpClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofSeconds(30))
                .build();
    }

    /**
     * 整图指令编辑：不传 mask，由万相理解 prompt 后生成新图。
     */
    public byte[] repaintFullImage(Path baseImage, String prompt, double strength) {
        try {
            byte[] bytes = Files.readAllBytes(baseImage);
            return repaintFullImage(bytes, guessMime(baseImage), prompt, strength);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("读取待重绘图像失败", e);
            throw new BusinessException("读取待重绘图像失败: " + e.getMessage(), e);
        }
    }

    /**
     * 蒙版局部重绘：白=编辑区，黑=保留。
     */
    public byte[] repaintWithMask(byte[] imageBytes, byte[] maskBytes, String mimeType, String prompt, double strength) {
        String apiKey = properties.getDashscope().getApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            throw new BusinessException("未配置 DASHSCOPE_API_KEY，无法调用通义万相");
        }

        try {
            ObjectNode input = objectMapper.createObjectNode();
            input.put("function", "description_edit_with_mask");
            input.put("prompt", prompt);
            input.put("base_image_url", toDataUri(imageBytes, mimeType));
            input.put("mask_image_url", toDataUri(maskBytes, "image/png"));

            ObjectNode parameters = objectMapper.createObjectNode();
            parameters.put("n", 1);
            parameters.put("strength", Math.max(0.1, Math.min(1.0, strength)));

            log.info("提交万相蒙版编辑 model={} strength={}", properties.getPrimaryModel(), strength);
            return submitAsyncImageEdit(apiKey, input, parameters);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("通义万相蒙版编辑失败", e);
            throw new BusinessException("通义万相蒙版编辑失败: " + e.getMessage(), e);
        }
    }

    private byte[] submitAsyncImageEdit(String apiKey, ObjectNode input, ObjectNode parameters) throws Exception {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", properties.getPrimaryModel());
        body.set("input", input);
        body.set("parameters", parameters);

        String submitUrl = properties.getDashscope().getBaseUrl()
                + "/services/aigc/image2image/image-synthesis";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);
        headers.set("X-DashScope-Async", "enable");

        HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(body), headers);
        ResponseEntity<String> submitResp = restTemplate.exchange(
                submitUrl, HttpMethod.POST, entity, String.class
        );
        if (!submitResp.getStatusCode().is2xxSuccessful() || submitResp.getBody() == null) {
            throw mapHttpError(submitResp.getStatusCode().value(), submitResp.getBody());
        }

        JsonNode submitJson = objectMapper.readTree(submitResp.getBody());
        if (submitJson.has("code") && !submitJson.path("code").asText("").isBlank()) {
            throw mapDashScopeError(submitJson);
        }
        String taskId = submitJson.path("output").path("task_id").asText(null);
        if (taskId == null || taskId.isBlank()) {
            throw new BusinessException("万相 API 未返回 task_id: " + submitResp.getBody());
        }
        return pollTaskResult(apiKey, taskId);
    }

    /**
     * 整图指令编辑（字节输入，供尺寸适配后调用）。
     */
    public byte[] repaintFullImage(byte[] imageBytes, String mimeType, String prompt, double strength) {
        String apiKey = properties.getDashscope().getApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            throw new BusinessException("未配置 DASHSCOPE_API_KEY，无法调用通义万相");
        }

        try {
            ObjectNode input = objectMapper.createObjectNode();
            input.put("function", "description_edit");
            input.put("prompt", prompt);
            input.put("base_image_url", toDataUri(imageBytes, mimeType));

            ObjectNode parameters = objectMapper.createObjectNode();
            parameters.put("n", 1);
            parameters.put("strength", Math.max(0.1, Math.min(1.0, strength)));

            log.info("提交万相整图编辑 model={} strength={}", properties.getPrimaryModel(), strength);
            return submitAsyncImageEdit(apiKey, input, parameters);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("通义万相整图编辑失败", e);
            throw new BusinessException("通义万相整图编辑失败: " + e.getMessage(), e);
        }
    }

    private byte[] pollTaskResult(String apiKey, String taskId) throws Exception {
        String pollUrl = properties.getDashscope().getBaseUrl() + "/tasks/" + taskId;
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(apiKey);

        int maxAttempts = Math.max(10, properties.getTimeoutSeconds() / 2);
        for (int i = 0; i < maxAttempts; i++) {
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<String> resp = restTemplate.exchange(
                    pollUrl, HttpMethod.GET, entity, String.class
            );
            JsonNode json = objectMapper.readTree(resp.getBody());
            String status = json.path("output").path("task_status").asText(
                    json.path("task_status").asText("")
            );
            if ("SUCCEEDED".equalsIgnoreCase(status)) {
                JsonNode results = json.path("output").path("results");
                if (!results.isArray() || results.isEmpty()) {
                    throw new BusinessException("万相任务成功但无结果图");
                }
                String url = results.get(0).path("url").asText(null);
                if (url == null || url.isBlank()) {
                    throw new BusinessException("万相结果 URL 为空");
                }
                return downloadPresignedResult(url);
            }
            if ("FAILED".equalsIgnoreCase(status) || "CANCELED".equalsIgnoreCase(status)) {
                String msg = json.path("output").path("message").asText(
                        json.path("message").asText("万相任务失败")
                );
                throw mapWanxTaskError(msg);
            }
            Thread.sleep(2000L);
        }
        throw new BusinessException("万相任务超时（" + properties.getTimeoutSeconds() + "s），请稍后重试");
    }

    /**
     * 万相返回 OSS 预签名 URL；必须用原始 URL 下载，不可经 RestTemplate 重编码 query 参数。
     */
    private byte[] downloadPresignedResult(String signedUrl) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(signedUrl))
                    .timeout(Duration.ofSeconds(60))
                    .header("User-Agent", "3d-aigc-business-service")
                    .GET()
                    .build();
            HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() == 200 && response.body() != null && response.body().length > 0) {
                return response.body();
            }
            String errBody = response.body() != null
                    ? new String(response.body(), StandardCharsets.UTF_8)
                    : "";
            if (errBody.contains("SignatureDoesNotMatch")) {
                throw new BusinessException("下载万相结果图失败：OSS 签名不匹配，请重试");
            }
            throw new BusinessException(
                    "下载万相结果图失败: HTTP " + response.statusCode()
                            + (errBody.isBlank() ? "" : " " + truncate(errBody, 300))
            );
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("下载万相结果图失败: " + e.getMessage(), e);
        }
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max) + "...";
    }

    private BusinessException mapHttpError(int status, String body) {
        if (status == 401 || status == 403) {
            return new BusinessException("万相 API Key 无效或无权访问，请检查 DASHSCOPE_API_KEY");
        }
        if (status == 429) {
            return new BusinessException("万相 API 限流，请稍后重试");
        }
        return new BusinessException("万相 API 提交失败: HTTP " + status + (body != null ? " " + body : ""));
    }

    private BusinessException mapDashScopeError(JsonNode json) {
        String code = json.path("code").asText("");
        String msg = json.path("message").asText(json.toString());
        if (code.contains("InvalidApiKey") || code.contains("Auth")) {
            return new BusinessException("万相 API Key 无效: " + msg);
        }
        if (code.contains("Throttling") || code.contains("RateLimit")) {
            return new BusinessException("万相 API 限流: " + msg);
        }
        return new BusinessException("万相 API 错误: " + msg);
    }

    private BusinessException mapWanxTaskError(String msg) {
        if (msg != null) {
            String lower = msg.toLowerCase();
            if ((lower.contains("height") || lower.contains("width"))
                    && lower.contains("512") && lower.contains("4096")) {
                return new BusinessException(
                        "万相生成失败：图像尺寸不符合要求（宽高需在 512–4096 像素）。"
                                + " 系统已自动缩放，若仍失败请换一张更大的原图。详情: " + msg
                );
            }
        }
        return new BusinessException("万相生成失败: " + msg);
    }

    private static String toDataUri(byte[] bytes, String mime) {
        return "data:" + mime + ";base64," + Base64.getEncoder().encodeToString(bytes);
    }

    private static String guessMime(Path path) {
        String name = path.getFileName().toString().toLowerCase();
        if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        if (name.endsWith(".webp")) {
            return "image/webp";
        }
        return "image/png";
    }
}
