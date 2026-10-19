package com.jewelry.system.service;

import com.jewelry.system.entity.ConversationMember;
import com.jewelry.system.entity.ConversationMessageTranslation;
import com.jewelry.system.entity.User;
import com.jewelry.system.repository.*;
import com.jewelry.system.security.AccountKind;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 聊天消息自动翻译：复用 DashScopeChatService（通义千问）做翻译，
 * 按（消息ID + 目标语言）缓存结果，避免重复调用。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MessageTranslationService {

    private static final String SYSTEM_PROMPT =
            "你是一名专业的珠宝定制行业翻译。请把用户输入的文本翻译成目标语言。" +
            "要求：1) 只输出翻译结果，不要输出任何解释、注释或原文；" +
            "2) 若原文已经是目标语言，请原样返回，不要改动；" +
            "3) 保留珠宝行业专业术语的准确性；" +
            "4) 保留数字、金额、尺寸单位与专有名词；5) 保持原文的语气与格式。";

    private final ConversationMessageTranslationRepository translationRepository;
    private final ConversationMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final PortalCustomerAccountRepository portalCustomerAccountRepository;
    private final B2BClientRepository b2bClientRepository;
    private final ConversationSocketService socketService;
    private final DashScopeChatService dashScopeChatService;
    private final IntegrationSettingsService integrationSettingsService;
    private final PlatformTransactionManager transactionManager;

    /**
     * 获取或生成翻译（同步，保证准确性）。LLM 调用在事务外，写缓存在独立事务。
     */
    public String getOrTranslate(Long messageId, String content, String targetLang) {
        if (messageId == null || !StringUtils.hasText(content) || !StringUtils.hasText(targetLang)) {
            return null;
        }
        // 缓存命中；但早期误写入的假翻译不再直接回显，重新走 LLM
        var cached = translationRepository.findByMessageIdAndTargetLang(messageId, targetLang);
        if (cached.isPresent()) {
            String hit = cached.get().getTranslatedContent();
            if (isUsableTranslation(content, hit)) {
                return hit.trim();
            }
        }
        // 未命中：调用真实大模型翻译；失败或返回与原文相同均视为无翻译，不再做假兜底
        String translated = translate(content, targetLang);
        if (!isUsableTranslation(content, translated)) {
            return null;
        }
        saveTranslation(messageId, targetLang, translated.trim());
        return translated.trim();
    }

    /**
     * 只读缓存：列表渲染路径使用，绝不触发 LLM 调用，避免列表接口被同步翻译拖垮（504）。
     */
    public String getCached(Long messageId, String targetLang) {
        if (messageId == null || !StringUtils.hasText(targetLang)) {
            return null;
        }
        return translationRepository.findByMessageIdAndTargetLang(messageId, targetLang)
                .map(t -> {
                    String hit = t.getTranslatedContent();
                    // 早期假翻译不回显
                    return hit != null && hit.matches("^\\[(EN|FR|DE|ES|JP|KR|繁)]\\s.*") ? null : hit;
                })
                .orElse(null);
    }

    /**
     * 异步预翻译：消息发送后为会话内各成员的目标语言预热翻译缓存，并推送翻译完成事件。
     */
    @Async("translationExecutor")
    public void preTranslateAsync(Long messageId, String content, Long conversationId) {
        if (messageId == null || !StringUtils.hasText(content) || conversationId == null) {
            return;
        }
        List<ConversationMember> members = memberRepository.findByConversationIdOrderByJoinedAtAsc(conversationId);
        // 按账号解析成员语言，去重
        Map<String, List<ConversationMember>> byLang = new LinkedHashMap<>();
        for (ConversationMember m : members) {
            String lang = resolveMemberLang(m);
            if (!isSupported(lang)) {
                continue;
            }
            byLang.computeIfAbsent(lang, k -> new java.util.ArrayList<>()).add(m);
        }
        for (Map.Entry<String, List<ConversationMember>> e : byLang.entrySet()) {
            String lang = e.getKey();
            String translated = getOrTranslate(messageId, content, lang);
            if (translated == null) {
                continue;
            }
            for (ConversationMember m : e.getValue()) {
                Map<String, Object> data = Map.of(
                        "messageId", messageId,
                        "targetLang", lang,
                        "translatedContent", translated
                );
                socketService.send(m.getAccountType(), m.getAccountId(), "MESSAGE_TRANSLATED", data);
            }
        }
    }

    /**
     * 纯翻译调用（不涉及缓存）。
     */
    public String translate(String text, String targetLang) {
        try {
            String langName = langName(targetLang);
            String prompt = "目标语言：" + langName + "\n\n待翻译文本：\n" + text;
            String result = dashScopeChatService.complete(SYSTEM_PROMPT, null, prompt);
            if (result == null) {
                return null;
            }
            return result.trim();
        } catch (ResponseStatusException e) {
            log.warn("翻译失败（降级为不翻译）: {}", e.getMessage());
            return null;
        } catch (Exception e) {
            log.warn("翻译异常（降级为不翻译）", e);
            return null;
        }
    }

    /** 语言代码 → 完整语言名（用于 LLM 提示词，避免「en」歧义）。 */
    private static String langName(String lang) {
        if (lang == null) {
            return "中文";
        }
        return switch (lang.trim()) {
            case "en" -> "English（英语）";
            case "zh-CN" -> "简体中文";
            case "zh-TW" -> "繁體中文";
            case "fr" -> "French（法语）";
            case "de" -> "German（德语）";
            case "es" -> "Spanish（西班牙语）";
            case "ja" -> "Japanese（日语）";
            case "ko" -> "Korean（韩语）";
            default -> lang.trim();
        };
    }

    /**
     * 判断 LLM 返回是否为「有效翻译」。
     * 目标语言为非中文时，翻译结果不能仍是原文/以中文为主，否则视为模型未真正翻译。
     */
    static boolean isUsableTranslation(String source, String translated) {
        if (translated == null) {
            return false;
        }
        String trimmed = translated.trim();
        if (trimmed.isEmpty() || trimmed.equals(source == null ? null : source.trim())) {
            return false;
        }
        // 早期误写入的假翻译（如 [JP] 原文）一律视为无效
        if (trimmed.matches("^\\[(EN|FR|DE|ES|JP|KR|繁)]\\s.*")) {
            return false;
        }
        return true;
    }

    /**
     * 写缓存使用独立事务（避免在 listMessages 的只读事务里写库导致 rollback-only）。
     */
    public void saveTranslation(Long messageId, String targetLang, String translated) {
        try {
            TransactionTemplate tt = new TransactionTemplate(transactionManager);
            tt.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            tt.executeWithoutResult(status -> {
                ConversationMessageTranslation t = new ConversationMessageTranslation();
                t.setMessageId(messageId);
                t.setTargetLang(targetLang);
                t.setTranslatedContent(translated);
                var llm = integrationSettingsService.requireLlm();
                t.setProvider(llm != null ? llm.provider() : "kimi");
                translationRepository.save(t);
            });
        } catch (Exception e) {
            log.warn("保存翻译缓存失败（忽略）: messageId={}", messageId, e);
        }
    }

    private String resolveMemberLang(ConversationMember member) {
        try {
            AccountKind type = member.getAccountType();
            Long id = member.getAccountId();
            if (type == AccountKind.STAFF) {
                return userRepository.findById(id).map(User::getLang).orElse("zh-CN");
            }
            if (type == AccountKind.C_PORTAL_CUSTOMER) {
                return portalCustomerAccountRepository.findById(id)
                        .map(a -> StringUtils.hasText(a.getLang()) ? a.getLang() : "en")
                        .orElse("en");
            }
            if (type == AccountKind.B2B_CLIENT) {
                return b2bClientRepository.findById(id)
                        .map(c -> StringUtils.hasText(c.getLang()) ? c.getLang() : "zh-CN")
                        .orElse("zh-CN");
            }
            return null;
        } catch (Exception e) {
            log.warn("解析成员语言失败", e);
            return null;
        }
    }

    private static boolean isSupported(String lang) {
        return lang != null && List.of("en", "fr", "de", "es", "ja", "ko", "zh-CN", "zh-TW").contains(lang);
    }
}
