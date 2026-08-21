package com.jewelry.system.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 首页文案多语言翻译：复用 DashScope 大模型，输入中文，输出 8 语言 JSON。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class HomeContentTranslationService {

    public static final List<String> LANGS = List.of("zh-CN", "en", "fr", "de", "es", "ja", "ko", "zh-TW");

    private static final String SYSTEM_PROMPT =
            "你是一名资深珠宝品牌多语言文案翻译。请把用户输入的中文文案翻译成 8 种语言，" +
            "只输出一个 JSON 对象，不要输出任何解释。JSON 的 key 固定为：zh-CN,en,fr,de,es,ja,ko,zh-TW。" +
            "要求：1) zh-CN 保持原文不变；2) 翻译要信达雅、符合高端珠宝品牌调性，避免生硬直译；" +
            "3) 保留珠宝专业术语（如 镶嵌、爪镶、18K金、钻石、戒指、项链、耳饰、手镯、定制 等）的准确性；" +
            "4) 保留数字、金额、尺寸单位与专有名词；5) 每个 value 直接是翻译结果字符串。";

    private final DashScopeChatService dashScopeChatService;
    private final ObjectMapper objectMapper;

    public Map<String, String> translate(String zhText) {
        try {
            String result = dashScopeChatService.complete(SYSTEM_PROMPT, null, "待翻译中文文案：\n" + zhText);
            if (result == null || result.isBlank()) {
                return fallback(zhText);
            }
            JsonNode root = objectMapper.readTree(stripCodeFence(result));
            if (root == null || !root.isObject()) {
                return fallback(zhText);
            }
            Map<String, String> out = new LinkedHashMap<>();
            for (String lang : LANGS) {
                JsonNode v = root.get(lang);
                out.put(lang, v != null && !v.isNull() ? v.asText() : zhText);
            }
            return out;
        } catch (Exception e) {
            log.warn("首页文案翻译失败，回退中文", e);
            return fallback(zhText);
        }
    }

    private Map<String, String> fallback(String zhText) {
        Map<String, String> out = new LinkedHashMap<>();
        for (String lang : LANGS) {
            out.put(lang, zhText);
        }
        return out;
    }

    private String stripCodeFence(String s) {
        String t = s.trim();
        if (t.startsWith("```")) {
            int first = t.indexOf('\n');
            if (first >= 0) {
                t = t.substring(first + 1);
            }
            int last = t.lastIndexOf("```");
            if (last >= 0) {
                t = t.substring(0, last);
            }
        }
        return t.trim();
    }
}
