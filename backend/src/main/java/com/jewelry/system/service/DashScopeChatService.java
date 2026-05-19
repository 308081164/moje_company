package com.jewelry.system.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class DashScopeChatService {

    private static final String COMPAT_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

    public record ChatTurn(String role, String content) {}

    private final IntegrationSettingsService integrationSettingsService;
    private final ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    public String complete(String systemPrompt, List<ChatTurn> history, String userMessage) {
        String apiKey = integrationSettingsService.requireDashScopeApiKey();
        if (apiKey == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "未启用或未配置通义千问 API Key，请联系管理员在「系统配置 → 销售助手集成」中配置");
        }
        String model = integrationSettingsService.dashScopeChatModel();

        ArrayNode messages = objectMapper.createArrayNode();
        messages.add(objectMapper.createObjectNode().put("role", "system").put("content", systemPrompt));
        if (history != null) {
            for (ChatTurn t : history) {
                if (t.content() == null || t.content().isBlank()) {
                    continue;
                }
                messages.add(objectMapper.createObjectNode().put("role", t.role()).put("content", t.content()));
            }
        }
        messages.add(objectMapper.createObjectNode().put("role", "user").put("content", userMessage));

        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", model);
        body.set("messages", messages);

        HttpRequest req = HttpRequest.newBuilder(URI.create(COMPAT_URL))
                .timeout(Duration.ofSeconds(120))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8))
                .build();

        try {
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                log.warn("DashScope chat HTTP {} {}", resp.statusCode(), resp.body());
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "通义千问对话失败（HTTP " + resp.statusCode() + "）");
            }
            JsonNode root = objectMapper.readTree(resp.body());
            JsonNode content = root.path("choices").path(0).path("message").path("content");
            if (content.isMissingNode() || content.isNull()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "通义千问返回内容为空");
            }
            return content.asText("");
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("DashScope chat error", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "通义千问对话异常: " + e.getMessage());
        }
    }
}
