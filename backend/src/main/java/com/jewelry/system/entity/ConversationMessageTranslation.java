package com.jewelry.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * 聊天消息翻译缓存：按（消息ID + 目标语言）缓存 LLM 翻译结果。
 */
@Data
@Entity
@Table(name = "conversation_message_translation")
@EntityListeners(AuditingEntityListener.class)
public class ConversationMessageTranslation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "message_id", nullable = false)
    private Long messageId;

    @Column(name = "target_lang", nullable = false, length = 16)
    private String targetLang;

    @Column(name = "translated_content", nullable = false, columnDefinition = "TEXT")
    private String translatedContent;

    @Column(length = 20)
    private String provider = "dashscope";

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
