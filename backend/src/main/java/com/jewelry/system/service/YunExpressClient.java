package com.jewelry.system.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 云途开放平台客户端。默认沙盒 https://openapi-sbx.yunexpress.cn。
 * 鉴权：appId / appSecret / sourceKey 换 accessToken，业务请求用 HMAC-SHA256 签名。
 * 密钥只从环境变量读取。只有 YUNEXPRESS_ENV=production 才访问正式地址。
 */
@Slf4j
@Service
public class YunExpressClient {

    static final String DEFAULT_SANDBOX_BASE = "https://openapi-sbx.yunexpress.cn";
    static final String DEFAULT_PRODUCTION_BASE = "https://openapi.yunexpress.cn";
    private static final String TOKEN_PATH = "/openapi/oauth2/token";
    private static final String CREATE_PATH = "/v1/order/package/create";
    private static final String TRACK_PATH = "/v1/track-service/info/get";
    private static final String PRICE_PATH = "/v1/price-trial/get";
    private static final String CANCEL_PATH = "/v1/order/cancel";
    private static final String HOLD_PATH = "/v1/order/hold";
    private static final String WEIGHT_PATH = "/v1/order/weight/modify";
    private static final String LABEL_PATH = "/v1/order/label/get";
    private static final String DOCS_PATH = "/v1/order/shipping-docs/get";
    private static final String POD_PATH = "/v1/order/pod/get";
    private static final String LAST_MILE_PATH = "/v1/order/last-mile/get";

    private final String env;
    private final String appId;
    private final String appSecret;
    private final String sourceKey;
    private final String shippingMethod;
    private final String sandboxBaseUrl;
    private final String productionBaseUrl;
    private final String senderName;
    private final String senderPhone;
    private final String senderCountry;
    private final String senderProvince;
    private final String senderCity;
    private final String senderAddress;
    private final String senderPostal;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    private String accessToken;
    private long tokenExpireAtMillis;

    public YunExpressClient(
            @Value("${app.logistics.yunexpress.env:sandbox}") String env,
            @Value("${app.logistics.yunexpress.app-id:}") String appId,
            @Value("${app.logistics.yunexpress.app-secret:}") String appSecret,
            @Value("${app.logistics.yunexpress.source-key:}") String sourceKey,
            @Value("${app.logistics.yunexpress.shipping-method:THPHR}") String shippingMethod,
            @Value("${app.logistics.yunexpress.sandbox-base-url:" + DEFAULT_SANDBOX_BASE + "}") String sandboxBaseUrl,
            @Value("${app.logistics.yunexpress.production-base-url:" + DEFAULT_PRODUCTION_BASE + "}") String productionBaseUrl,
            @Value("${app.logistics.yunexpress.sender-name:MOJE}") String senderName,
            @Value("${app.logistics.yunexpress.sender-phone:075512345678}") String senderPhone,
            @Value("${app.logistics.yunexpress.sender-country:CN}") String senderCountry,
            @Value("${app.logistics.yunexpress.sender-province:Guangdong}") String senderProvince,
            @Value("${app.logistics.yunexpress.sender-city:Shenzhen}") String senderCity,
            @Value("${app.logistics.yunexpress.sender-address:Nanshan Science Park}") String senderAddress,
            @Value("${app.logistics.yunexpress.sender-postal:518000}") String senderPostal,
            ObjectMapper objectMapper
    ) {
        this.env = env == null ? "sandbox" : env.trim();
        this.appId = trimToEmpty(appId);
        this.appSecret = trimToEmpty(appSecret);
        this.sourceKey = trimToEmpty(sourceKey);
        this.shippingMethod = StringUtils.hasText(shippingMethod) ? shippingMethod.trim() : "THPHR";
        this.sandboxBaseUrl = normalizeBase(sandboxBaseUrl, DEFAULT_SANDBOX_BASE);
        this.productionBaseUrl = normalizeBase(productionBaseUrl, DEFAULT_PRODUCTION_BASE);
        this.senderName = StringUtils.hasText(senderName) ? senderName.trim() : "MOJE";
        this.senderPhone = StringUtils.hasText(senderPhone) ? senderPhone.trim() : "075512345678";
        this.senderCountry = StringUtils.hasText(senderCountry) ? senderCountry.trim() : "CN";
        this.senderProvince = StringUtils.hasText(senderProvince) ? senderProvince.trim() : "Guangdong";
        this.senderCity = StringUtils.hasText(senderCity) ? senderCity.trim() : "Shenzhen";
        this.senderAddress = StringUtils.hasText(senderAddress) ? senderAddress.trim() : "Nanshan Science Park";
        this.senderPostal = StringUtils.hasText(senderPostal) ? senderPostal.trim() : "518000";
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public boolean isSandbox() {
        return !"production".equalsIgnoreCase(env);
    }

    public boolean isConfigured() {
        return StringUtils.hasText(appId) && StringUtils.hasText(appSecret) && StringUtils.hasText(sourceKey);
    }

    public String shippingMethod() {
        return shippingMethod;
    }

    public String baseUrl() {
        if (isSandbox()) {
            if (sandboxBaseUrl.contains("openapi.yunexpress.cn") && !sandboxBaseUrl.contains("openapi-sbx")) {
                return DEFAULT_SANDBOX_BASE;
            }
            return sandboxBaseUrl;
        }
        if (productionBaseUrl.contains("sbx") || productionBaseUrl.contains("uat")) {
            return DEFAULT_PRODUCTION_BASE;
        }
        return productionBaseUrl;
    }

    public CreatedWaybill createOrder(OrderDraft draft) {
        requireConfigured();
        ObjectNode order = objectMapper.createObjectNode();
        String product = StringUtils.hasText(draft.productCode) ? draft.productCode.trim() : shippingMethod;
        order.put("product_code", product);
        order.put("customer_order_number", draft.customerOrderNumber);
        order.put("weight_unit", "KG");
        ObjectNode receiver = order.putObject("receiver");
        receiver.put("first_name", draft.firstName);
        if (StringUtils.hasText(draft.lastName)) {
            receiver.put("last_name", draft.lastName);
        }
        receiver.put("country_code", draft.countryCode);
        if (StringUtils.hasText(draft.state)) {
            receiver.put("province", draft.state);
        }
        receiver.put("city", draft.city);
        ArrayNode addressLines = receiver.putArray("address_lines");
        addressLines.add(draft.street);
        if (StringUtils.hasText(draft.street2)) {
            addressLines.add(draft.street2);
        }
        if (StringUtils.hasText(draft.street3) && addressLines.size() < 3) {
            addressLines.add(draft.street3);
        }
        receiver.put("postal_code", draft.postalCode);
        receiver.put("phone_number", draft.phone);
        ObjectNode sender = order.putObject("sender");
        sender.put("first_name", senderName);
        sender.put("country_code", senderCountry);
        sender.put("province", senderProvince);
        sender.put("city", senderCity);
        sender.putArray("address_lines").add(senderAddress);
        sender.put("postal_code", senderPostal);
        sender.put("phone_number", senderPhone);
        ArrayNode packages = order.putArray("packages");
        ObjectNode parcel = packages.addObject();
        parcel.put("weight", draft.weightKg);
        ArrayNode declarations = order.putArray("declaration_info");
        ObjectNode declaration = declarations.addObject();
        declaration.put("quantity", Math.max(1, draft.quantity));
        declaration.put("unit_price", draft.unitPriceUsd);
        declaration.put("unit_weight", draft.unitWeightKg);
        declaration.put("name_en", englishGoodsName(draft.englishName));
        declaration.put("name_local", chineseGoodsName(draft.chineseName));
        declaration.put("currency", "USD");
        JsonNode root = exchange("POST", CREATE_PATH, order);
        if (!isSuccess(root)) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "云途下单失败：" + errorMessage(root));
        }
        JsonNode result = root.get("result");
        String waybill = text(result, "waybill_number");
        if (!StringUtils.hasText(waybill)) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "云途未返回运单号");
        }
        CreatedWaybill created = new CreatedWaybill();
        created.waybillNumber = waybill.trim();
        created.trackingNumber = text(result, "tracking_number");
        created.customerOrderNumber = text(result, "customer_order_number");
        return created;
    }

    /**
     * 查询轨迹。没有节点时返回空列表，不补造轨迹。查询失败返回 null，由调用方保留原快照。
     */
    public TrackSnapshot getTrack(String orderNumber) {
        if (!isConfigured() || !StringUtils.hasText(orderNumber)) {
            return null;
        }
        try {
            String encoded = URLEncoder.encode(orderNumber.trim(), StandardCharsets.UTF_8);
            String path = TRACK_PATH + "?order_number=" + encoded;
            JsonNode root = exchange("GET", path, null);
            if (!isSuccess(root)) {
                log.warn("[yunexpress] 查询轨迹未成功 code={}", text(root, "code"));
                return null;
            }
            JsonNode result = root.get("result");
            if (result == null || result.isNull() || (result.isArray() && result.isEmpty())) {
                TrackSnapshot empty = new TrackSnapshot();
                empty.events = List.of();
                empty.statusLabel = "已发货（暂无轨迹节点）";
                return empty;
            }
            JsonNode item = result.isArray() ? result.get(0) : result;
            TrackSnapshot snapshot = new TrackSnapshot();
            snapshot.packageStatus = text(item, "package_status");
            snapshot.statusLabel = packageStatusLabel(snapshot.packageStatus);
            snapshot.events = new ArrayList<>();
            JsonNode info = item.get("track_Info");
            if (info == null || info.isNull()) {
                info = item.get("track_info");
            }
            JsonNode details = info == null ? null : info.get("track_events");
            if (details != null && details.isArray()) {
                for (JsonNode node : details) {
                    TrackEvent event = new TrackEvent();
                    event.time = firstText(node, "process_time", "process_utc_time");
                    event.location = locationOf(node);
                    event.description = describe(node);
                    event.statusCode = text(node, "track_node_code");
                    if (!StringUtils.hasText(event.description)) {
                        continue;
                    }
                    snapshot.events.add(event);
                }
            }
            if (snapshot.events.isEmpty() && !StringUtils.hasText(snapshot.statusLabel)) {
                snapshot.statusLabel = "已发货（暂无轨迹节点）";
            }
            return snapshot;
        } catch (ResponseStatusException e) {
            log.warn("[yunexpress] 查询轨迹失败: {}", e.getReason());
            return null;
        } catch (Exception e) {
            log.warn("[yunexpress] 查询轨迹失败: {}", e.getMessage());
            return null;
        }
    }

    public List<QuoteOption> quote(String countryCode, String postalCode, double weightKg, int pieces) {
        requireConfigured();
        StringBuilder uri = new StringBuilder(PRICE_PATH)
                .append("?country_code=").append(encode(countryCode))
                .append("&weight=").append(formatWeight(weightKg))
                .append("&weight_unit=KG")
                .append("&pieces=").append(Math.max(1, pieces));
        if (StringUtils.hasText(postalCode)) {
            uri.append("&postal_code=").append(encode(postalCode.trim()));
        }
        JsonNode root = exchange("GET", uri.toString(), null);
        if (!isSuccess(root)) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "运费试算失败：" + errorMessage(root));
        }
        Map<String, QuoteOption> grouped = new LinkedHashMap<>();
        JsonNode result = root.get("result");
        if (result != null && result.isArray()) {
            for (JsonNode row : result) {
                String code = text(row, "product_code");
                if (!StringUtils.hasText(code)) {
                    continue;
                }
                QuoteOption option = grouped.computeIfAbsent(code, key -> {
                    QuoteOption created = new QuoteOption();
                    created.productCode = key;
                    created.productName = text(row, "product_name");
                    created.currency = firstText(row, "convert_currency", "currency");
                    created.intervalDay = text(row, "interval_day");
                    return created;
                });
                option.amount += row.path("convert_amount").asDouble(row.path("calculate_amount").asDouble(0));
                if (!StringUtils.hasText(option.intervalDay)) {
                    option.intervalDay = text(row, "interval_day");
                }
            }
        }
        List<QuoteOption> options = new ArrayList<>(grouped.values());
        options.sort(Comparator.comparingDouble(item -> item.amount));
        if (options.size() > 8) {
            List<QuoteOption> top = new ArrayList<>(options.subList(0, 8));
            options.stream().filter(item -> shippingMethod.equalsIgnoreCase(item.productCode))
                    .findFirst()
                    .filter(item -> top.stream().noneMatch(row -> row.productCode.equals(item.productCode)))
                    .ifPresent(top::add);
            return top;
        }
        return options;
    }

    public void cancelWaybill(String waybillNumber) {
        postWaybill(CANCEL_PATH, waybillNumber, null, null);
    }

    public void holdWaybill(String waybillNumber, String remark) {
        postWaybill(HOLD_PATH, waybillNumber, remark, null);
    }

    public void modifyWeight(String waybillNumber, double weightKg) {
        postWaybill(WEIGHT_PATH, waybillNumber, null, weightKg);
    }

    public DocumentLink label(String orderNumber) {
        return document(LABEL_PATH, orderNumber, "面单");
    }

    public DocumentLink shippingDocument(String orderNumber) {
        return document(DOCS_PATH, orderNumber, "发货证明");
    }

    public DocumentLink proofOfDelivery(String orderNumber) {
        return document(POD_PATH, orderNumber, "签收证明");
    }

    public LastMile lastMile(String waybillNumber) {
        if (!isConfigured() || !StringUtils.hasText(waybillNumber)) {
            return null;
        }
        try {
            ObjectNode body = objectMapper.createObjectNode();
            body.putArray("waybill_numbers").add(waybillNumber.trim());
            JsonNode root = exchange("POST", LAST_MILE_PATH, body);
            if (!isSuccess(root)) {
                return null;
            }
            JsonNode carriers = root.path("result").path("carriers");
            if (!carriers.isArray() || carriers.isEmpty()) {
                return null;
            }
            JsonNode carrier = carriers.get(0);
            LastMile mile = new LastMile();
            mile.name = text(carrier, "last_mile_name");
            mile.code = text(carrier, "last_mile_code");
            mile.site = text(carrier, "last_mile_site");
            mile.phone = text(carrier, "phone_number");
            mile.trackingNumber = text(carrier, "tracking_number");
            if (!StringUtils.hasText(mile.name) && !StringUtils.hasText(mile.trackingNumber)) {
                return null;
            }
            return mile;
        } catch (Exception e) {
            log.warn("[yunexpress] 查询末端派送商失败: {}", e.getMessage());
            return null;
        }
    }

    private void postWaybill(String path, String waybillNumber, String remark, Double weightKg) {
        requireConfigured();
        if (!StringUtils.hasText(waybillNumber)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "缺少云途运单号");
        }
        ObjectNode body = objectMapper.createObjectNode();
        body.put("waybill_number", waybillNumber.trim());
        if (remark != null) {
            body.put("remark", remark.trim());
        }
        if (weightKg != null) {
            body.put("weight", Double.parseDouble(formatWeight(weightKg)));
            body.put("weight_unit", "KG");
        }
        JsonNode root = exchange("POST", path, body);
        if (!isSuccess(root)) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "云途未接受操作：" + errorMessage(root));
        }
    }

    private DocumentLink document(String path, String orderNumber, String label) {
        requireConfigured();
        if (!StringUtils.hasText(orderNumber)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "缺少云途运单号");
        }
        JsonNode root = exchange("GET", path + "?order_number=" + encode(orderNumber.trim()), null);
        if (!isSuccess(root)) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "云途暂未生成" + label + "：" + errorMessage(root));
        }
        String url = text(root.path("result"), "url");
        if (!StringUtils.hasText(url)) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "云途暂未生成" + label);
        }
        DocumentLink link = new DocumentLink();
        link.url = url;
        link.labelType = text(root.path("result"), "label_type");
        return link;
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    static String formatWeight(double weightKg) {
        if (weightKg < 0.001 || weightKg > 10000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "重量需在 0.001 到 10000 千克之间");
        }
        return String.format(java.util.Locale.US, "%.3f", weightKg);
    }

    static String signContent(String method, String uri, String body, String dateMillis) {
        if (StringUtils.hasText(body)) {
            return "body=" + body + "&date=" + dateMillis + "&method=" + method + "&uri=" + uri;
        }
        return "date=" + dateMillis + "&method=" + method + "&uri=" + uri;
    }

    static String hmacSha256Base64(String secret, String content) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getEncoder().encodeToString(mac.doFinal(content.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("云途签名计算失败", e);
        }
    }

    private void requireConfigured() {
        if (!isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "云途凭证未配置，请在服务器环境变量中设置后再使用快捷发货");
        }
    }

    private JsonNode exchange(String method, String uri, JsonNode body) {
        JsonNode first = sendSigned(method, uri, body, false);
        if (isAuthFailure(first)) {
            synchronized (this) {
                accessToken = null;
                tokenExpireAtMillis = 0;
            }
            return sendSigned(method, uri, body, true);
        }
        return first;
    }

    private JsonNode sendSigned(String method, String uri, JsonNode body, boolean refreshed) {
        try {
            String json = body == null ? "" : objectMapper.writeValueAsString(body);
            String date = Long.toString(System.currentTimeMillis());
            String sign = hmacSha256Base64(appSecret, signContent(method, uri, json, date));
            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(baseUrl() + uri))
                    .timeout(Duration.ofSeconds(25))
                    .header("Accept", "application/json")
                    .header("Accept-Language", "zh-CN")
                    .header("token", currentToken())
                    .header("date", date)
                    .header("sign", sign);
            HttpRequest request;
            if ("POST".equals(method)) {
                request = builder.header("Content-Type", "application/json;charset=utf-8")
                        .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                        .build();
            } else {
                request = builder.GET().build();
            }
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (!StringUtils.hasText(response.body())) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "云途接口返回空内容");
            }
            JsonNode root = objectMapper.readTree(response.body());
            if (response.statusCode() == 401 && !refreshed) {
                return root;
            }
            if (response.statusCode() >= 500) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "云途接口返回 HTTP " + response.statusCode());
            }
            return root;
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.warn("[yunexpress] 请求失败: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "云途接口暂时无法连接");
        }
    }

    private boolean isAuthFailure(JsonNode root) {
        String code = text(root, "code");
        return "0200401102".equals(code) || "0200401101".equals(code);
    }

    private synchronized String currentToken() {
        if (StringUtils.hasText(accessToken) && System.currentTimeMillis() < tokenExpireAtMillis) {
            return accessToken;
        }
        try {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("grantType", "client_credentials");
            body.put("appId", appId);
            body.put("appSecret", appSecret);
            body.put("sourceKey", sourceKey);
            String json = objectMapper.writeValueAsString(body);
            HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl() + TOKEN_PATH))
                    .timeout(Duration.ofSeconds(20))
                    .header("Accept", "application/json")
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300 || !StringUtils.hasText(response.body())) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "云途鉴权失败");
            }
            JsonNode root = objectMapper.readTree(response.body());
            String token = text(root, "accessToken");
            if (!StringUtils.hasText(token)) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "云途鉴权未返回令牌");
            }
            int expiresIn = root.path("expiresIn").asInt(3600);
            accessToken = token;
            tokenExpireAtMillis = System.currentTimeMillis() + Math.max(60, expiresIn - 60) * 1000L;
            return accessToken;
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.warn("[yunexpress] 鉴权失败: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "云途鉴权暂时无法连接");
        }
    }

    private static boolean isSuccess(JsonNode root) {
        JsonNode success = root.get("success");
        if (success == null || success.isNull()) {
            return false;
        }
        if (success.isBoolean()) {
            return success.asBoolean();
        }
        return "true".equalsIgnoreCase(success.asText());
    }

    private static String errorMessage(JsonNode root) {
        String message = firstText(root, "msg", "message");
        if (!StringUtils.hasText(message)) {
            message = "云途未接受运单";
        }
        return trim(message, 300);
    }

    static String chineseGoodsName(String value) {
        String name = StringUtils.hasText(value) ? value.trim() : "";
        boolean hasHan = name.codePoints().anyMatch(cp -> Character.UnicodeScript.of(cp) == Character.UnicodeScript.HAN);
        if (!hasHan) {
            name = "银饰";
        }
        return name.length() <= 50 ? name : name.substring(0, 50);
    }

    static String englishGoodsName(String value) {
        String name = StringUtils.hasText(value) ? value.trim() : "silver jewelry";
        return name.length() <= 50 ? name : name.substring(0, 50);
    }

    private static String locationOf(JsonNode node) {
        String location = text(node, "process_location");
        if (StringUtils.hasText(location)) {
            return location;
        }
        List<String> parts = new ArrayList<>();
        add(parts, text(node, "process_city"));
        add(parts, text(node, "process_province"));
        add(parts, text(node, "process_country"));
        return parts.isEmpty() ? null : String.join(", ", parts);
    }

    private static void add(List<String> parts, String value) {
        if (StringUtils.hasText(value)) {
            parts.add(value);
        }
    }

    static String describe(JsonNode node) {
        String content = firstText(node, "process_content", "ProcessContent");
        String nodeCode = firstText(node, "track_node_code", "TrackNodeCode");
        if ("ORDER_CREATION".equalsIgnoreCase(nodeCode)
                || "Shipment information received".equalsIgnoreCase(content)) {
            return "已收到发货预报";
        }
        if (content != null && content.codePoints().anyMatch(cp -> Character.UnicodeScript.of(cp) == Character.UnicodeScript.HAN)) {
            return content;
        }
        if ("Order created".equalsIgnoreCase(content)) {
            return "订单已创建";
        }
        return content;
    }

    static String packageStatusLabel(String status) {
        if (!StringUtils.hasText(status)) {
            return "已发货（待物流更新）";
        }
        return switch (status.trim().toUpperCase()) {
            case "F", "1" -> "已提交";
            case "T", "P", "2" -> "运输中";
            case "D", "3" -> "已签收";
            case "A", "4" -> "已收货";
            case "C", "5" -> "订单取消";
            case "E", "6" -> "投递失败";
            case "R", "7" -> "已退回";
            default -> "已发货（待物流更新）";
        };
    }

    private static String normalizeBase(String value, String fallback) {
        String url = StringUtils.hasText(value) ? value.trim() : fallback;
        while (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        return url;
    }

    private static String trimToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private static String trim(String value, int max) {
        if (value == null) {
            return "";
        }
        String text = value.trim();
        return text.length() <= max ? text : text.substring(0, max);
    }

    private static String firstText(JsonNode node, String... names) {
        if (node == null) {
            return null;
        }
        for (String name : names) {
            String value = text(node, name);
            if (StringUtils.hasText(value)) {
                return value;
            }
        }
        return null;
    }

    private static String text(JsonNode node, String name) {
        if (node == null || !node.has(name) || node.get(name).isNull()) {
            return null;
        }
        String value = node.get(name).asText();
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    public static class OrderDraft {
        public String customerOrderNumber;
        public String countryCode;
        public String firstName;
        public String lastName;
        public String street;
        public String street2;
        public String street3;
        public String city;
        public String state;
        public String postalCode;
        public String phone;
        public String chineseName;
        public String englishName;
        public String productCode;
        public int quantity = 1;
        public double weightKg = 0.2;
        public double unitWeightKg = 0.2;
        public double unitPriceUsd = 10;
        public boolean prepayIoss;
    }

    public static class CreatedWaybill {
        public String waybillNumber;
        public String trackingNumber;
        public String customerOrderNumber;
    }

    public static class TrackSnapshot {
        public String packageStatus;
        public String statusLabel;
        public List<TrackEvent> events = List.of();
    }

    public static class TrackEvent {
        public String time;
        public String location;
        public String description;
        public String statusCode;
    }

    public static class QuoteOption {
        public String productCode;
        public String productName;
        public String currency;
        public String intervalDay;
        public double amount;
    }

    public static class DocumentLink {
        public String url;
        public String labelType;
    }

    public static class LastMile {
        public String name;
        public String code;
        public String site;
        public String phone;
        public String trackingNumber;
    }
}
