package com.jewelry.system.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * AI_3d_DataBase（8871）HTTP 客户端代理。
 * 持有共享服务账号，登录后缓存 token，401 时自动重登重试一次。
 * 仅复用其接口能力，不涉及 UI。
 */
@Slf4j
@Service
public class InlayDbClient {

    private final String apiBase;
    private final String username;
    private final String password;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    private volatile String cachedToken;

    public InlayDbClient(
            @Value("${app.inlay-db.api-base:http://192.168.1.10:8871/api}") String apiBase,
            @Value("${app.inlay-db.username:moje}") String username,
            @Value("${app.inlay-db.password:}") String password,
            ObjectMapper objectMapper
    ) {
        this.apiBase = apiBase == null ? "" : apiBase.replaceAll("/+$", "");
        this.username = username;
        this.password = password;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();
    }

    // ---------- 登录与 token ----------

    private synchronized String token() {
        if (cachedToken != null && !cachedToken.isBlank()) {
            return cachedToken;
        }
        login();
        return cachedToken;
    }

    private void login() {
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(apiBase + "/auth/login"))
                    .timeout(Duration.ofSeconds(30))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(
                            objectMapper.writeValueAsString(Map.of(
                                    "username", username,
                                    "password", password == null ? "" : password
                            )), StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            JsonNode root = objectMapper.readTree(resp.body());
            if (resp.statusCode() < 200 || resp.statusCode() >= 300 || root.path("code").asInt(-1) != 200) {
                String msg = root.path("message").asText("登录 AI_3d_DataBase 失败");
                log.error("[inlay-db] 登录失败 HTTP {}: {}", resp.statusCode(), msg);
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, msg);
            }
            JsonNode tokenNode = root.path("data").path("token");
            if (tokenNode.isMissingNode() || tokenNode.asText("").isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI_3d_DataBase 未返回 token");
            }
            cachedToken = tokenNode.asText();
            log.info("[inlay-db] 登录成功 user={}", root.path("data").path("user").path("username").asText(""));
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("[inlay-db] 登录异常", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI_3d_DataBase 登录异常: " + e.getMessage());
        }
    }

    // ---------- 底层请求 ----------

    /** JSON GET，返回远程 Result.data 节点。 */
    public JsonNode getData(String path, Map<String, String> params) {
        String url = buildUrl(path, params);
        HttpRequest req = baseRequest(url).GET().build();
        return sendJson(req, true);
    }

    /** JSON POST（body 为对象，序列化为 JSON）。 */
    public JsonNode postData(String path, Object body) {
        HttpRequest req = baseRequest(apiBase + path)
                .header("Content-Type", "application/json")
                .POST(jsonPublisher(body))
                .build();
        return sendJson(req, false);
    }

    /** multipart POST（files 键为远程字段名；fields 为文本字段）。 */
    public JsonNode postMultipart(String path, Map<String, MultipartFile> files, Map<String, String> fields) {
        byte[] body = buildMultipartBody(files, fields);
        HttpRequest req = baseRequest(apiBase + path)
                .header("Content-Type", "multipart/form-data; boundary=" + MULTIPART_BOUNDARY)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build();
        return sendJson(req, false);
    }

    /** 二进制 GET，返回 bytes + contentType（用于 thumbnail/mesh/glb/download/assets/preprocess-image）。 */
    public BinaryResp getBinary(String path, Map<String, String> params) {
        String url = buildUrl(path, params);
        HttpRequest req = baseRequest(url).GET().build();
        return sendBinary(req, true);
    }

    /** 二进制 POST（识结构图片预处理等，图片走 multipart 单独处理，这里保留通用 JSON/字节场景）。 */
    public BinaryResp postBinary(String path, Map<String, String> params, byte[] body, String contentType) {
        String url = buildUrl(path, params);
        HttpRequest req = baseRequest(url)
                .header("Content-Type", contentType)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build();
        return sendBinary(req, false);
    }

    /** multipart POST 但返回二进制（用于 preprocess-image 返回 PNG）。 */
    public byte[] postMultipartBinary(String path, Map<String, MultipartFile> files, Map<String, String> fields) {
        byte[] body = buildMultipartBody(files, fields);
        HttpRequest req = baseRequest(apiBase + path)
                .header("Content-Type", "multipart/form-data; boundary=" + MULTIPART_BOUNDARY)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build();
        try {
            HttpResponse<byte[]> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofByteArray());
            if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI_3d_DataBase 二进制请求失败 HTTP " + resp.statusCode());
            }
            return resp.body();
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("[inlay-db] 二进制 multipart 请求失败", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI_3d_DataBase 二进制请求失败: " + e.getMessage());
        }
    }

    // ---------- 内部实现 ----------

    private HttpRequest.Builder baseRequest(String url) {
        return HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(600))
                .header("Authorization", "Bearer " + token())
                .header("Accept", "application/json");
    }

    private JsonNode sendJson(HttpRequest req, boolean retryable) {
        try {
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (resp.statusCode() == 401 && retryable) {
                // token 失效：重新登录并重试一次
                cachedToken = null;
                HttpRequest retry = copyWithNewToken(req);
                resp = httpClient.send(retry, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            }
            JsonNode root = objectMapper.readTree(resp.body());
            if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                String msg = root.path("message").asText("远程服务错误");
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI_3d_DataBase: " + msg);
            }
            int code = root.path("code").asInt(-1);
            if (code != 200) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, root.path("message").asText("AI_3d_DataBase 错误"));
            }
            return root.path("data");
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("[inlay-db] JSON 请求失败", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI_3d_DataBase 请求失败: " + e.getMessage());
        }
    }

    private BinaryResp sendBinary(HttpRequest req, boolean retryable) {
        try {
            HttpResponse<byte[]> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofByteArray());
            if (resp.statusCode() == 401 && retryable) {
                cachedToken = null;
                HttpRequest retry = copyWithNewToken(req);
                resp = httpClient.send(retry, HttpResponse.BodyHandlers.ofByteArray());
            }
            if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI_3d_DataBase 二进制请求失败 HTTP " + resp.statusCode());
            }
            String ct = resp.headers().firstValue("Content-Type").orElse("application/octet-stream");
            String filename = resp.headers().firstValue("Content-Disposition")
                    .map(InlayDbClient::extractFilename).orElse(null);
            return new BinaryResp(resp.body(), ct, filename);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("[inlay-db] 二进制请求失败", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI_3d_DataBase 二进制请求失败: " + e.getMessage());
        }
    }

    /** 仅用于 GET 请求的 401 重试：用新 token 重建同 URL 的 GET 请求。 */
    private HttpRequest copyWithNewToken(HttpRequest original) {
        HttpRequest.Builder b = HttpRequest.newBuilder(original.uri())
                .timeout(Duration.ofSeconds(600))
                .header("Authorization", "Bearer " + token())
                .header("Accept", "application/json");
        // 复刻除 Authorization 外的其它头（GET 场景无 body）
        original.headers().map().forEach((k, vals) -> {
            if (!"Authorization".equalsIgnoreCase(k)) {
                vals.forEach(v -> b.header(k, v));
            }
        });
        return b.GET().build();
    }

    private HttpRequest.BodyPublisher jsonPublisher(Object body) {
        try {
            return HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "JSON 序列化失败: " + e.getMessage());
        }
    }

    private String buildUrl(String path, Map<String, String> params) {
        String url = apiBase + path;
        if (params != null && !params.isEmpty()) {
            StringBuilder qs = new StringBuilder();
            params.forEach((k, v) -> {
                if (v == null) return;
                if (qs.length() > 0) qs.append('&');
                qs.append(encode(k)).append('=').append(encode(v));
            });
            if (qs.length() > 0) url = url + "?" + qs;
        }
        return url;
    }

    private static String encode(String s) {
        return java.net.URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    private static final String MULTIPART_BOUNDARY = "----MojeInlayDbBoundary" + UUID.randomUUID().toString().replace("-", "");

    private byte[] buildMultipartBody(Map<String, MultipartFile> files, Map<String, String> fields) {
        try {
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            // 文本字段
            if (fields != null) {
                for (Map.Entry<String, String> e : fields.entrySet()) {
                    if (e.getValue() == null) continue;
                    writePart(out, e.getKey(), null, null, e.getValue().getBytes(StandardCharsets.UTF_8));
                }
            }
            // 文件字段
            if (files != null) {
                for (Map.Entry<String, MultipartFile> e : files.entrySet()) {
                    MultipartFile f = e.getValue();
                    if (f == null || f.isEmpty()) continue;
                    String filename = f.getOriginalFilename() != null ? f.getOriginalFilename() : "file";
                    String contentType = f.getContentType() != null ? f.getContentType() : "application/octet-stream";
                    writePart(out, e.getKey(), filename, contentType, f.getBytes());
                }
            }
            out.write(("--" + MULTIPART_BOUNDARY + "--\r\n").getBytes(StandardCharsets.UTF_8));
            return out.toByteArray();
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "multipart 构建失败: " + e.getMessage());
        }
    }

    private void writePart(java.io.ByteArrayOutputStream out, String name, String filename, String contentType, byte[] data) throws java.io.IOException {
        StringBuilder head = new StringBuilder();
        head.append("--").append(MULTIPART_BOUNDARY).append("\r\n");
        head.append("Content-Disposition: form-data; name=\"").append(name).append("\"");
        if (filename != null) {
            head.append("; filename=\"").append(filename.replace("\"", "")).append("\"");
        }
        head.append("\r\n");
        if (contentType != null) {
            head.append("Content-Type: ").append(contentType).append("\r\n");
        }
        head.append("\r\n");
        out.write(head.toString().getBytes(StandardCharsets.UTF_8));
        out.write(data);
        out.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private static String extractFilename(String contentDisposition) {
        for (String part : contentDisposition.split(";")) {
            String t = part.trim();
            if (t.startsWith("filename=")) {
                return t.substring("filename=".length()).replace("\"", "").trim();
            }
        }
        return null;
    }

    public record BinaryResp(byte[] bytes, String contentType, String filename) {}
}
