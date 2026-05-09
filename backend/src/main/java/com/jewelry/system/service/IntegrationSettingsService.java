package com.jewelry.system.service;

import com.jewelry.system.dto.integration.IntegrationSettingsViewDto;
import com.jewelry.system.entity.SysConfig;
import com.jewelry.system.repository.SysConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class IntegrationSettingsService {

    public record WeComContext(String corpId, String customerSecret, List<String> templateChatIds) {}

    public static final String KEY_DASHSCOPE_API_KEY = "integration.dashscope.apiKey";
    public static final String KEY_DASHSCOPE_ENABLED = "integration.dashscope.enabled";
    public static final String KEY_DASHSCOPE_MODEL = "integration.dashscope.vlModel";

    public static final String KEY_WECOM_CORP_ID = "integration.wecom.corpId";
    public static final String KEY_WECOM_CUSTOMER_SECRET = "integration.wecom.customerSecret";
    public static final String KEY_WECOM_ENABLED = "integration.wecom.enabled";
    public static final String KEY_WECOM_TEMPLATE_CHAT_IDS = "integration.wecom.templateChatIds";

    private final SysConfigRepository sysConfigRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public IntegrationSettingsViewDto getView() {
        String key = read(KEY_DASHSCOPE_API_KEY, "");
        return IntegrationSettingsViewDto.builder()
                .dashscopeEnabled(parseBool(read(KEY_DASHSCOPE_ENABLED, "false"), false))
                .dashscopeApiKeyConfigured(key != null && !key.isBlank())
                .dashscopeImageModel(read(KEY_DASHSCOPE_MODEL, "qwen-vl-plus"))
                .wecomEnabled(parseBool(read(KEY_WECOM_ENABLED, "false"), false))
                .wecomCustomerSecretConfigured(!read(KEY_WECOM_CUSTOMER_SECRET, "").isBlank())
                .wecomCorpId(read(KEY_WECOM_CORP_ID, ""))
                .wecomTemplateChatIds(read(KEY_WECOM_TEMPLATE_CHAT_IDS, ""))
                .build();
    }

    @Transactional
    public IntegrationSettingsViewDto patch(Map<String, Object> body) {
        if (body == null || body.isEmpty()) {
            return getView();
        }
        if (body.containsKey("dashscopeEnabled")) {
            upsert(KEY_DASHSCOPE_ENABLED, String.valueOf(body.get("dashscopeEnabled")), "DashScope 识图开关");
        }
        if (body.containsKey("dashscopeImageModel")) {
            upsert(KEY_DASHSCOPE_MODEL, String.valueOf(body.get("dashscopeImageModel")), "DashScope 视觉模型名");
        }
        if (body.containsKey("dashscopeApiKey")) {
            Object v = body.get("dashscopeApiKey");
            if (v != null) {
                String s = String.valueOf(v).trim();
                if (!s.isEmpty() && !"__UNCHANGED__".equals(s)) {
                    upsert(KEY_DASHSCOPE_API_KEY, s, "DashScope API Key");
                }
            }
        }
        if (body.containsKey("wecomEnabled")) {
            upsert(KEY_WECOM_ENABLED, String.valueOf(body.get("wecomEnabled")), "企业微信自动进群开关");
        }
        if (body.containsKey("wecomCorpId")) {
            upsert(KEY_WECOM_CORP_ID, String.valueOf(body.get("wecomCorpId")), "企业微信 CorpId");
        }
        if (body.containsKey("wecomCustomerSecret")) {
            Object v = body.get("wecomCustomerSecret");
            if (v != null) {
                String s = String.valueOf(v).trim();
                if (!s.isEmpty() && !"__UNCHANGED__".equals(s)) {
                    upsert(KEY_WECOM_CUSTOMER_SECRET, s, "企业微信客户联系 Secret");
                }
            }
        }
        if (body.containsKey("wecomTemplateChatIds")) {
            upsert(KEY_WECOM_TEMPLATE_CHAT_IDS, String.valueOf(body.get("wecomTemplateChatIds")), "企微种子客户群 chat_id");
        }
        return getView();
    }

    @Transactional(readOnly = true)
    public String requireDashScopeApiKey() {
        if (!parseBool(read(KEY_DASHSCOPE_ENABLED, "false"), false)) {
            return null;
        }
        String k = read(KEY_DASHSCOPE_API_KEY, "");
        return k.isBlank() ? null : k;
    }

    /**
     * 企业微信自动进群：需开启开关且 CorpId、客户联系 Secret、种子客户群 chat_id 均配置。
     */
    @Transactional(readOnly = true)
    public Optional<WeComContext> getWeComContext() {
        if (!parseBool(read(KEY_WECOM_ENABLED, "false"), false)) {
            return Optional.empty();
        }
        String corp = read(KEY_WECOM_CORP_ID, "");
        String secret = read(KEY_WECOM_CUSTOMER_SECRET, "");
        String rawIds = read(KEY_WECOM_TEMPLATE_CHAT_IDS, "");
        List<String> ids = parseChatIds(rawIds);
        if (corp.isBlank() || secret.isBlank() || ids.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new WeComContext(corp, secret, ids));
    }

    private List<String> parseChatIds(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        String t = raw.trim();
        if (t.startsWith("[")) {
            try {
                return objectMapper.readValue(t, new TypeReference<List<String>>() {
                });
            } catch (Exception e) {
                return List.of();
            }
        }
        List<String> out = new ArrayList<>();
        for (String p : t.split("[,，\\s]+")) {
            if (p != null && !p.isBlank()) {
                out.add(p.trim());
            }
        }
        return out;
    }

    @Transactional(readOnly = true)
    public String dashScopeModel() {
        return read(KEY_DASHSCOPE_MODEL, "qwen-vl-plus");
    }

    private String read(String key, String def) {
        return sysConfigRepository.findByConfigKey(key)
                .map(SysConfig::getConfigValue)
                .filter(s -> s != null && !s.isBlank())
                .orElse(def);
    }

    private void upsert(String key, String value, String description) {
        SysConfig row = sysConfigRepository.findByConfigKey(key).orElseGet(SysConfig::new);
        row.setConfigKey(key);
        row.setConfigValue(value);
        row.setConfigType(SysConfig.ConfigValueType.STRING);
        row.setDescription(description);
        sysConfigRepository.save(row);
    }

    private static boolean parseBool(String raw, boolean def) {
        if (raw == null || raw.isBlank()) {
            return def;
        }
        return "true".equalsIgnoreCase(raw.trim()) || "1".equals(raw.trim());
    }
}
