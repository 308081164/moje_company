package com.jewelry.system.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.marketing.OrderMarketingCopyDto;
import com.jewelry.system.dto.order.OrderInfoDto;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.OrderMarketingCopy;
import com.jewelry.system.entity.User;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.repository.OrderMarketingCopyRepository;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.UserRepository;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderMarketingCopyService {

    private static final String COMPAT_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

    private final OrderMarketingCopyRepository orderMarketingCopyRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final IntegrationSettingsService integrationSettingsService;
    private final ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    public void assertMarketingRole() {
        String r = SecurityUtils.currentRoleApi().orElse("");
        if (!("ADMIN".equals(r) || "PRE_SALES".equals(r) || "SALES".equals(r))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无营销文案功能权限");
        }
    }

    @Transactional
    public void ensurePendingRowForCompletedOrder(long orderId) {
        if (orderMarketingCopyRepository.existsByOrder_Id(orderId)) {
            return;
        }
        Order o = orderRepository.findById(orderId).orElse(null);
        if (o == null || o.getStatus() != OrderStatus.COMPLETED) {
            return;
        }
        OrderMarketingCopy mc = new OrderMarketingCopy();
        mc.setOrder(o);
        mc.setGenerationComplete(false);
        orderMarketingCopyRepository.save(mc);
    }

    @Transactional(readOnly = true)
    public Page<OrderInfoDto> pagePending(Pageable pageable) {
        assertMarketingRole();
        return orderMarketingCopyRepository.pagePending(OrderStatus.COMPLETED, pageable)
                .map(mc -> OrderApiMapper.toOrderInfo(mc.getOrder(), false));
    }

    @Transactional(readOnly = true)
    public OrderMarketingCopyDto getDto(long orderId) {
        assertMarketingRole();
        OrderMarketingCopy mc = orderMarketingCopyRepository.findByOrder_Id(orderId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "该订单无营销文案任务"));
        return toDto(mc);
    }

    private OrderMarketingCopyDto toDto(OrderMarketingCopy mc) {
        Order o = mc.getOrder();
        User by = mc.getLastGeneratedBy();
        return OrderMarketingCopyDto.builder()
                .orderId(o.getId())
                .orderNumber(o.getOrderNumber())
                .generationComplete(mc.isGenerationComplete())
                .xhsGrassCopy(mc.getXhsGrassCopy())
                .xianyuTaobaoCopy(mc.getXianyuTaobaoCopy())
                .douyinBroadcastCopy(mc.getDouyinBroadcastCopy())
                .lastGeneratedAt(mc.getLastGeneratedAt())
                .lastGeneratedByName(by != null ? by.getRealName() : null)
                .build();
    }

    @Transactional
    public OrderMarketingCopyDto generate(long orderId) {
        assertMarketingRole();
        long uid = SecurityUtils.currentStaffUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        User user = userRepository.getReferenceById(uid);

        String apiKey = integrationSettingsService.requireDashScopeApiKey();
        if (apiKey == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "未启用或未配置通义千问 API Key，请在「系统配置 → 销售助手集成」中开启并填写");
        }

        Order order = orderRepository.findById(orderId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
        if (order.getStatus() != OrderStatus.COMPLETED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "仅已完成订单可生成营销文案");
        }

        OrderMarketingCopy mc = orderMarketingCopyRepository.findByOrder_Id(orderId).orElseGet(() -> {
            OrderMarketingCopy n = new OrderMarketingCopy();
            n.setOrder(order);
            n.setGenerationComplete(false);
            return n;
        });

        String orderDigest = buildOrderDigest(order);
        String systemPrompt = """
                你是珠宝定制与轻奢首饰营销专家。根据给定的订单摘要，分别撰写三段可直接发布的营销文案。
                必须只输出一个 JSON 对象，不要 Markdown，不要代码块，不要解释。
                字段：xhsGrassCopy（小红书种草风格，含表情与话题建议）、xianyuTaobaoCopy（闲鱼/淘宝商品描述，分段清晰）、douyinBroadcastCopy（抖音短视频口播稿，口语化，约45至90秒口播量）。
                各字段为字符串；语气真实、合规，不编造证书与价格欺骗。
                """;

        String model = integrationSettingsService.dashScopeModel();
        if (model != null && model.toLowerCase().startsWith("qwen-vl")) {
            model = "qwen-plus";
        }

        String body = objectMapper.createObjectNode()
                .put("model", model)
                .set("messages", objectMapper.createArrayNode()
                        .add(objectMapper.createObjectNode().put("role", "system").put("content", systemPrompt))
                        .add(objectMapper.createObjectNode().put("role", "user").put("content", "订单摘要：\n" + orderDigest)))
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
                log.warn("DashScope marketing HTTP {} {}", resp.statusCode(), truncate(resp.body(), 800));
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "通义千问接口调用失败（HTTP " + resp.statusCode() + "）");
            }
            JsonNode parsed = parseMarketingJson(resp.body());
            mc.setXhsGrassCopy(textOrEmpty(parsed, "xhsGrassCopy"));
            mc.setXianyuTaobaoCopy(textOrEmpty(parsed, "xianyuTaobaoCopy"));
            mc.setDouyinBroadcastCopy(textOrEmpty(parsed, "douyinBroadcastCopy"));
            mc.setGenerationComplete(true);
            mc.setLastGeneratedAt(LocalDateTime.now());
            mc.setLastGeneratedBy(user);
            mc.setRawModelResponse(truncate(resp.body(), 8000));
            orderMarketingCopyRepository.save(mc);
            return toDto(mc);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("marketing copy generate", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "通义千问调用异常: " + e.getMessage());
        }
    }

    private static String textOrEmpty(JsonNode root, String field) {
        JsonNode n = root.path(field);
        return n.isMissingNode() || !n.isTextual() ? "" : n.asText("");
    }

    private JsonNode parseMarketingJson(String responseBody) throws java.io.IOException {
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
        return objectMapper.readTree(json);
    }

    private static String extractJsonObject(String text) {
        int i = text.indexOf('{');
        int j = text.lastIndexOf('}');
        if (i >= 0 && j > i) {
            return text.substring(i, j + 1);
        }
        return text.trim();
    }

    private static String buildOrderDigest(Order o) {
        StringBuilder sb = new StringBuilder();
        sb.append("订单编号: ").append(o.getOrderNumber()).append('\n');
        if (o.getCustomerName() != null) {
            sb.append("客户: ").append(o.getCustomerName()).append('\n');
        }
        if (o.getBasicRequirements() != null) {
            sb.append("需求: ").append(o.getBasicRequirements()).append('\n');
        }
        if (o.getStyleInfo() != null) {
            sb.append("款式: ").append(o.getStyleInfo()).append('\n');
        }
        if (o.getMaterialInfo() != null) {
            sb.append("材质: ").append(o.getMaterialInfo()).append('\n');
        }
        return sb.toString();
    }

    private static String truncate(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() <= max ? s : s.substring(0, max) + "...";
    }

    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> zipExport(List<Long> orderIds) {
        assertMarketingRole();
        if (orderIds == null || orderIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择至少一个订单");
        }
        if (orderIds.size() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "单次最多导出 100 个订单");
        }
        try (ByteArrayOutputStream bos = new ByteArrayOutputStream();
                ZipOutputStream zos = new ZipOutputStream(bos, StandardCharsets.UTF_8)) {
            for (Long oid : orderIds) {
                OrderMarketingCopy mc = orderMarketingCopyRepository.findByOrder_Id(oid).orElseThrow(() ->
                        new ResponseStatusException(HttpStatus.NOT_FOUND, "订单 " + oid + " 无营销文案记录"));
                if (!mc.isGenerationComplete()) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "订单 " + oid + " 尚未生成营销文案");
                }
                Order o = mc.getOrder();
                String prefix = "order_" + o.getId() + "_" + sanitize(o.getOrderNumber()) + "/";
                zipTextEntry(zos, prefix + "xiaohongshu.txt", coalesce(mc.getXhsGrassCopy()));
                zipTextEntry(zos, prefix + "xianyu_taobao.txt", coalesce(mc.getXianyuTaobaoCopy()));
                zipTextEntry(zos, prefix + "douyin_koubo.txt", coalesce(mc.getDouyinBroadcastCopy()));
            }
            zos.finish();
            byte[] bytes = bos.toByteArray();
            String filename = "marketing-copy-" + System.currentTimeMillis() + ".zip";
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .body(bytes);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("zip marketing copy", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "打包失败: " + e.getMessage());
        }
    }

    private static void zipTextEntry(ZipOutputStream zos, String path, String text) throws java.io.IOException {
        zos.putNextEntry(new ZipEntry(path));
        zos.write(text.getBytes(StandardCharsets.UTF_8));
        zos.closeEntry();
    }

    private static String coalesce(String s) {
        return s != null ? s : "";
    }

    private static String sanitize(String orderNumber) {
        if (orderNumber == null || orderNumber.isBlank()) {
            return "order";
        }
        return orderNumber.replaceAll("[^a-zA-Z0-9._\\-\\u4e00-\\u9fa5]+", "_");
    }
}
