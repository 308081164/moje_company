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
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
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

    /**
     * 获取或生成翻译（同步，保证准确性）。LLM 调用在事务外，写缓存在独立事务。
     */
    public String getOrTranslate(Long messageId, String content, String targetLang) {
        if (messageId == null || !StringUtils.hasText(content) || !StringUtils.hasText(targetLang)) {
            return null;
        }
        // 缓存命中
        var cached = translationRepository.findByMessageIdAndTargetLang(messageId, targetLang);
        if (cached.isPresent()) {
            return cached.get().getTranslatedContent();
        }
        // 未命中：调用 LLM 翻译
        String translated = translate(content, targetLang);
        if (translated == null || translated.isBlank() || translated.equals(content)) {
            return null;
        }
        saveTranslation(messageId, targetLang, translated);
        return translated;
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
            String prompt = "目标语言：" + targetLang + "\n\n待翻译文本：\n" + text;
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

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void saveTranslation(Long messageId, String targetLang, String translated) {
        ConversationMessageTranslation t = new ConversationMessageTranslation();
        t.setMessageId(messageId);
        t.setTargetLang(targetLang);
        t.setTranslatedContent(translated);
        t.setProvider("dashscope");
        translationRepository.save(t);
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
