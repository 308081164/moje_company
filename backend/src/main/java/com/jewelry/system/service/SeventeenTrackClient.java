package com.jewelry.system.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 17TRACK 国际物流查询客户端（可插拔，未启用或失败时静默降级）。
 * <p>接口：POST {base}/register（注册单号）、POST {base}/gettrackinfo（查询轨迹），认证头 {@code 17token}。</p>
 */
@Slf4j
@Service
public class SeventeenTrackClient {

    private final boolean enabled;
    private final String apiKey;
    private final String baseUrl;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public SeventeenTrackClient(
            @Value("${app.logistics.seventeen-track.enabled:false}") boolean enabled,
            @Value("${app.logistics.seventeen-track.api-key:}") String apiKey,
            @Value("${app.logistics.seventeen-track.base-url:https://api.17track.net/track/v2.4}") String baseUrl,
            ObjectMapper objectMapper
    ) {
        this.enabled = enabled;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.baseUrl = baseUrl == null ? "" : baseUrl.trim().replaceAll("/+$", "");
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public boolean isEnabled() {
        return enabled && StringUtils.hasText(apiKey);
    }

    /**
     * 注册单号（用于订阅轨迹推送）。
     *
     * @return 是否被接受
     */
    public boolean register(String trackingNumber, Integer carrierCode) {
        if (!isEnabled()) {
            return false;
        }
        try {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("number", trackingNumber);
            if (carrierCode != null) {
                item.put("carrier", carrierCode);
            }
            JsonNode resp = post("/register", List.of(item));
            JsonNode accepted = resp.path("accepted");
            return accepted.isArray() && accepted.size() > 0;
        } catch (Exception e) {
            log.warn("[17track] 注册单号失败（降级）: {}", e.getMessage());
            return false;
        }
    }

    /**
     * 查询轨迹，尽力解析；失败返回 null。
     */
    public TrackResult getTrackInfo(String trackingNumber, Integer carrierCode) {
        if (!isEnabled()) {
            return null;
        }
        try {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("number", trackingNumber);
            if (carrierCode != null) {
                item.put("carrier", carrierCode);
            }
            JsonNode resp = post("/gettrackinfo", List.of(item));
            JsonNode accepted = resp.path("accepted");
            if (!accepted.isArray() || accepted.size() == 0) {
                return null;
            }
            JsonNode node = accepted.get(0);
            TrackResult result = new TrackResult();
            result.trackingNumber = node.path("number").asText(trackingNumber);
            result.carrierCode = node.hasNonNull("carrier") ? node.path("carrier").asInt() : carrierCode;
            result.carrierName = carrierNameOf(node);
            result.statusCode = resolveStatusCode(node);
            result.statusLabel = statusLabel(result.statusCode);
            result.events = parseEvents(node);
            return result;
        } catch (Exception e) {
            log.warn("[17track] 查询轨迹失败（降级）: {}", e.getMessage());
            return null;
        }
    }

    private JsonNode post(String path, Object body) throws Exception {
        String url = baseUrl + path;
        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(10))
                .header("17token", apiKey)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(
                        objectMapper.writeValueAsString(body), StandardCharsets.UTF_8))
                .build();
        HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            throw new IllegalStateException("HTTP " + resp.statusCode());
        }
        JsonNode root = objectMapper.readTree(resp.body());
        return root.path("data");
    }

    private String carrierNameOf(JsonNode node) {
        // carrier_name / carrierName / carrier 描述等字段，尽力而为
        for (String key : new String[]{"carrier_name", "carrierName", "carrier_name_cn"}) {
            if (node.hasNonNull(key)) {
                return node.path(key).asText();
            }
        }
        return null;
    }

    private String resolveStatusCode(JsonNode node) {
        // 顶层 status（数字）优先；否则取 track.e 或最新事件状态
        if (node.hasNonNull("status")) {
            return node.path("status").asText();
        }
        JsonNode track = node.path("track");
        if (track.isObject() && track.hasNonNull("e")) {
            return track.path("e").asText();
        }
        return null;
    }

    private List<TrackEvent> parseEvents(JsonNode node) {
        List<TrackEvent> events = new ArrayList<>();
        JsonNode track = node.path("track");
        if (!track.isObject()) {
            return events;
        }
        // 事件节点形如 z0, z1, z2 ...；字段 a=时间, c=地点, z=描述
        var fields = track.fields();
        List<JsonNode> zNodes = new ArrayList<>();
        while (fields.hasNext()) {
            var entry = fields.next();
            if (entry.getKey().startsWith("z") && entry.getValue().isObject()) {
                zNodes.add(entry.getValue());
            }
        }
        zNodes.sort((a, b) -> {
            String ta = a.path("a").asText("");
            String tb = b.path("a").asText("");
            return ta.compareTo(tb);
        });
        for (JsonNode z : zNodes) {
            TrackEvent e = new TrackEvent();
            e.time = textOf(z, "a");
            e.location = textOf(z, "c");
            e.description = textOf(z, "z");
            e.statusCode = textOf(z, "e");
            events.add(e);
        }
        return events;
    }

    private String textOf(JsonNode n, String key) {
        if (n == null || !n.has(key) || n.get(key).isNull()) {
            return null;
        }
        return n.get(key).asText();
    }

    /** 17TRACK 主状态码 → 中文标签（9 主状态，尽力映射，未知回退「状态码 N」）。 */
    private String statusLabel(String code) {
        if (code == null) {
            return "已发货（待物流更新）";
        }
        return switch (code.trim()) {
            case "0" -> "信息已收到";
            case "1" -> "运输中";
            case "2" -> "派送中";
            case "3" -> "已揽收";
            case "4" -> "已签收";
            case "5" -> "异常";
            case "6" -> "已过期";
            case "7" -> "查询不到";
            case "8" -> "预警";
            case "9" -> "已退回";
            default -> "状态码 " + code;
        };
    }

    public static class TrackResult {
        public String trackingNumber;
        public Integer carrierCode;
        public String carrierName;
        public String statusCode;
        public String statusLabel;
        public List<TrackEvent> events = new ArrayList<>();
    }

    public static class TrackEvent {
        public String time;
        public String location;
        public String description;
        public String statusCode;
    }
}
