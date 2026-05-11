package com.jewelry.system.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.jewelry.system.entity.Order;
import com.jewelry.system.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Optional;

/**
 * 企业微信客户群「加入群聊」：调用官方 add_join_way / get_join_way。
 * 每个订单在事务提交后异步创建<strong>独立</strong>的进群配置（config_id + 二维码）；种子群 chat_id 仅作模板，
 * 新客入群由企微按 {@code auto_create_room} 与 {@code room_base_name}/{@code room_base_id} 自动建新群链。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WeComCustomerGroupService {

    private static final String QYAPI = "https://qyapi.weixin.qq.com";

    private final IntegrationSettingsService integrationSettingsService;
    private final OrderRepository orderRepository;
    private final WeComOrderStatusUpdater weComOrderStatusUpdater;
    private final ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    private volatile String cachedToken;
    private volatile long cachedTokenExpireMs;

    @Async("salesAssistExecutor")
    public void scheduleAfterOrderCreated(Long orderId) {
        Optional<IntegrationSettingsService.WeComContext> ctxOpt = integrationSettingsService.getWeComContext();
        if (ctxOpt.isEmpty()) {
            log.info("企微进群未执行 orderId={}：integration 未就绪（需开启开关并配置 corpId、客户联系 Secret、至少一个种子客户群 chat_id）", orderId);
            return;
        }
        IntegrationSettingsService.WeComContext ctx = ctxOpt.get();
        try {
            Order order = orderRepository.findById(orderId).orElse(null);
            if (order == null) {
                return;
            }
            String token = fetchAccessToken(ctx.corpId(), ctx.customerSecret());
            String configId = addJoinWay(token, order, ctx.templateChatIds());
            String qr = getJoinWayQr(token, configId);
            weComOrderStatusUpdater.saveSuccess(orderId, configId, qr);
        } catch (Exception e) {
            log.warn("企微进群方式创建失败 orderId={} msg={}", orderId, e.getMessage());
            weComOrderStatusUpdater.saveFailure(orderId, e.getMessage());
        }
    }

    private String fetchAccessToken(String corpId, String secret) throws Exception {
        long now = System.currentTimeMillis();
        if (cachedToken != null && now < cachedTokenExpireMs - 60_000) {
            return cachedToken;
        }
        synchronized (this) {
            if (cachedToken != null && now < cachedTokenExpireMs - 60_000) {
                return cachedToken;
            }
            String url = QYAPI + "/cgi-bin/gettoken?corpid=" + urlEnc(corpId) + "&corpsecret=" + urlEnc(secret);
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(20))
                    .GET()
                    .build();
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            JsonNode root = objectMapper.readTree(resp.body());
            int err = root.path("errcode").asInt(0);
            if (err != 0) {
                throw new IllegalStateException("gettoken err " + err + ": " + root.path("errmsg").asText());
            }
            cachedToken = root.get("access_token").asText();
            int sec = root.path("expires_in").asInt(7200);
            cachedTokenExpireMs = System.currentTimeMillis() + sec * 1000L;
            return cachedToken;
        }
    }

    private String addJoinWay(String accessToken, Order order, java.util.List<String> chatIds) throws Exception {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("scene", 2);
        body.put("remark", "订单 " + order.getOrderNumber());
        body.put("auto_create_room", 1);
        body.put("room_base_name", "客户-" + order.getOrderNumber());
        long oid = order.getId() != null ? order.getId() : 0L;
        int roomBaseId = (int) (Math.abs(oid) % 1_000_000);
        body.put("room_base_id", roomBaseId == 0 ? 1 : roomBaseId);
        body.put("state", "order:" + order.getId());
        ArrayNode arr = body.putArray("chat_id_list");
        // 多个 chat_id 时客户会分散进多个已有群；每单独立进群链只挂一个种子群，由 auto_create_room + room_base_* 自动建新群
        String primary = chatIds.get(0);
        if (chatIds.size() > 1) {
            log.info("企微 add_join_way：订单 {} 配置了 {} 个种子群，仅使用第一个 chat_id 作为模板", order.getOrderNumber(), chatIds.size());
        }
        arr.add(primary);
        String url = QYAPI + "/cgi-bin/externalcontact/groupchat/add_join_way?access_token=" + urlEnc(accessToken);
        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8))
                .build();
        HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        JsonNode root = objectMapper.readTree(resp.body());
        int err = root.path("errcode").asInt(-1);
        if (err != 0) {
            throw new IllegalStateException("add_join_way " + err + ": " + root.path("errmsg").asText());
        }
        return root.get("config_id").asText();
    }

    private String getJoinWayQr(String accessToken, String configId) throws Exception {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("config_id", configId);
        String url = QYAPI + "/cgi-bin/externalcontact/groupchat/get_join_way?access_token=" + urlEnc(accessToken);
        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8))
                .build();
        HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        JsonNode root = objectMapper.readTree(resp.body());
        int err = root.path("errcode").asInt(-1);
        if (err != 0) {
            throw new IllegalStateException("get_join_way " + err + ": " + root.path("errmsg").asText());
        }
        String qr = root.path("join_way").path("qr_code").asText(null);
        if (qr == null || qr.isBlank()) {
            throw new IllegalStateException("get_join_way 未返回 qr_code");
        }
        if (qr.startsWith("data:image")) {
            int comma = qr.indexOf(',');
            if (comma > 0) {
                return qr.substring(comma + 1);
            }
        }
        return qr;
    }

    private static String urlEnc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}
