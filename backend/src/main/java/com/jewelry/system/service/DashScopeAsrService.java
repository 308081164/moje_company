package com.jewelry.system.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;

/**
 * 通义千问语音识别（qwen3-asr-flash，OpenAI 兼容模式）。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DashScopeAsrService {

    private static final String COMPAT_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
    private static final String DEFAULT_ASR_MODEL = "qwen3-asr-flash";
    private static final int MAX_BYTES = 10 * 1024 * 1024;

    private final IntegrationSettingsService integrationSettingsService;
    private final ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    public String transcribe(MultipartFile audio) {
        if (audio == null || audio.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请上传语音文件");
        }
        if (audio.getSize() > MAX_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "语音文件过大（最大 10MB）");
        }
        String apiKey = integrationSettingsService.requireDashScopeApiKey();
        if (apiKey == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "未启用或未配置通义千问 API Key，无法使用语音输入");
        }
        String mime = resolveMime(audio.getContentType(), audio.getOriginalFilename());
        String dataUrl;
        try {
            String b64 = Base64.getEncoder().encodeToString(audio.getBytes());
            dataUrl = "data:" + mime + ";base64," + b64;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "读取语音文件失败");
        }

        ObjectNode inputAudio = objectMapper.createObjectNode();
        inputAudio.put("data", dataUrl);

        ObjectNode audioPart = objectMapper.createObjectNode();
        audioPart.put("type", "input_audio");
        audioPart.set("input_audio", inputAudio);

        ArrayNode content = objectMapper.createArrayNode();
        content.add(audioPart);

        ObjectNode userMsg = objectMapper.createObjectNode();
        userMsg.put("role", "user");
        userMsg.set("content", content);

        ArrayNode messages = objectMapper.createArrayNode();
        messages.add(userMsg);

        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", DEFAULT_ASR_MODEL);
        body.set("messages", messages);

        HttpRequest req = HttpRequest.newBuilder(URI.create(COMPAT_URL))
                .timeout(Duration.ofSeconds(60))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8))
                .build();

        try {
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                log.warn("DashScope ASR HTTP {} {}", resp.statusCode(), resp.body());
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "语音识别失败（HTTP " + resp.statusCode() + "）");
            }
            JsonNode root = objectMapper.readTree(resp.body());
            JsonNode text = root.path("choices").path(0).path("message").path("content");
            if (text.isMissingNode() || text.isNull() || text.asText().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "语音识别结果为空");
            }
            return text.asText().trim();
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("DashScope ASR error", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "语音识别异常: " + e.getMessage());
        }
    }

    private static String resolveMime(String contentType, String filename) {
        if (contentType != null && !contentType.isBlank() && contentType.startsWith("audio/")) {
            return contentType.split(";")[0].trim();
        }
        if (filename != null) {
            String lower = filename.toLowerCase();
            if (lower.endsWith(".webm")) {
                return "audio/webm";
            }
            if (lower.endsWith(".wav")) {
                return "audio/wav";
            }
            if (lower.endsWith(".mp3")) {
                return "audio/mpeg";
            }
            if (lower.endsWith(".m4a")) {
                return "audio/mp4";
            }
            if (lower.endsWith(".ogg")) {
                return "audio/ogg";
            }
        }
        return "audio/webm";
    }
}
