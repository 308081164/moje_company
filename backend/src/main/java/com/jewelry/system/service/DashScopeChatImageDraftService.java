package com.jewelry.system.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.order.OrderDraftFromChatImageResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class DashScopeChatImageDraftService {

    private static final String COMPAT_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
    private static final int MAX_IMAGE_BYTES = 8 * 1024 * 1024;

    /** 与前端 OrderSource 一致（含 RECOMMEND / OTHER） */
    private static final Set<String> ALLOWED_SOURCES = Set.of(
            "DOUYIN", "BILIBILI", "XIAOHONGSHU", "TAOBAO", "XIANYU", "RECOMMEND", "OTHER"
    );

    private final IntegrationSettingsService integrationSettingsService;
    private final ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    public OrderDraftFromChatImageResponse draftFromImage(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请上传图片文件");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "图片过大，请压缩后上传（最大 8MB）");
        }
        String apiKey = integrationSettingsService.requireDashScopeApiKey();
        if (apiKey == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "未启用或未配置通义千问 API Key，请联系管理员在「系统配置 → 销售助手集成」中配置");
        }
        String model = integrationSettingsService.dashScopeModel();

        String mime = file.getContentType();
        if (mime == null || mime.isBlank()) {
            mime = "image/jpeg";
        }
        String b64 = Base64.getEncoder().encodeToString(file.getBytes());
        String dataUrl = "data:" + mime + ";base64," + b64;

        String systemPrompt = """
                你是珠宝定制公司的售前助理。用户上传的是与客户的聊天截图。请根据截图中的文字信息，提取创建订单所需的字段。
                必须只输出一个 JSON 对象，不要 Markdown，不要代码块，不要任何解释文字。
                JSON 字段与含义如下（缺失则填 null 或合理默认值）：
                customerName: 客户称呼或姓名
                customerContact: 手机号或微信号（优先手机号）
                customerWechat: 若与联系方式不同则填微信，否则 null
                source: 订单来源，必须是以下之一：DOUYIN,BILIBILI,XIAOHONGSHU,TAOBAO,XIANYU,RECOMMEND,OTHER
                sourceDetail: 若为 RECOMMEND 填达人昵称，否则 null
                depositAmount: 数字，若无则 0
                style: 款式简述，字符串或 null
                materialInfo: 材质简述，字符串或 null
                basicRequirements: 客户对款式/尺寸/预算等需求摘要，字符串
                orderTime: 字符串，格式 yyyy-MM-dd HH:mm:ss；若无法从截图推断则 null
                aiParseNote: 一句话说明你从截图中识别到的关键信息来源（可选）
                """;

        String userText = "请根据截图提取上述 JSON。";

        String body = objectMapper.createObjectNode()
                .put("model", model)
                .set("messages", objectMapper.createArrayNode()
                        .add(objectMapper.createObjectNode()
                                .put("role", "system")
                                .put("content", systemPrompt))
                        .add(objectMapper.createObjectNode()
                                .put("role", "user")
                                .set("content", objectMapper.createArrayNode()
                                        .add(objectMapper.createObjectNode()
                                                .put("type", "image_url")
                                                .set("image_url", objectMapper.createObjectNode().put("url", dataUrl)))
                                        .add(objectMapper.createObjectNode()
                                                .put("type", "text")
                                                .put("text", userText)))))
                .toString();

        HttpRequest req = HttpRequest.newBuilder(URI.create(COMPAT_URL))
                .timeout(Duration.ofSeconds(120))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();

        try {
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                log.warn("DashScope HTTP {} body {}", resp.statusCode(), truncate(resp.body(), 800));
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "通义千问接口调用失败（HTTP " + resp.statusCode() + "）");
            }
            return parseDraft(resp.body());
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("DashScope request error", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "通义千问接口调用异常: " + e.getMessage());
        }
    }

    private OrderDraftFromChatImageResponse parseDraft(String responseBody) throws IOException {
        JsonNode root = objectMapper.readTree(responseBody);
        JsonNode err = root.path("error");
        if (!err.isMissingNode() && err.path("message").isTextual()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "通义千问返回错误: " + err.get("message").asText());
        }
        String content = root.path("choices").path(0).path("message").path("content").asText(null);
        if (content == null || content.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "模型未返回有效内容");
        }
        String json = extractJsonObject(content);
        OrderDraftFromChatImageResponse dto = objectMapper.readValue(json, OrderDraftFromChatImageResponse.class);
        if (dto.getSource() != null) {
            String s = dto.getSource().trim().toUpperCase();
            if (!ALLOWED_SOURCES.contains(s)) {
                dto.setSource("OTHER");
            } else {
                dto.setSource(s);
            }
        }
        return dto;
    }

    private static String extractJsonObject(String text) {
        int i = text.indexOf('{');
        int j = text.lastIndexOf('}');
        if (i >= 0 && j > i) {
            return text.substring(i, j + 1);
        }
        return text.trim();
    }

    private static String truncate(String s, int max) {
        if (s == null) {
            return "";
        }
        return s.length() <= max ? s : s.substring(0, max) + "...";
    }
}
