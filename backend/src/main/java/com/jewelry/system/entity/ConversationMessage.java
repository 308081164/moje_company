package com.jewelry.system.entity;

import com.jewelry.system.security.AccountKind;
import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * 聊天室消息：支持文本/图片/文件/系统/事件卡片消息。
 */
@Data
@Entity
@Table(name = "conversation_message")
@EntityListeners(AuditingEntityListener.class)
public class ConversationMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "sender_type", nullable = false, length = 30)
    private AccountKind senderType;

    @Column(name = "sender_id", nullable = false)
    private Long senderId;

    /** 发送者业务角色展示名 */
    @Column(length = 30)
    private String role;

    /** text / image / file / system / event */
    @Column(name = "msg_type", nullable = false, length = 20)
    private String msgType = "text";

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "file_ids_json", columnDefinition = "TEXT")
    private String fileIdsJson;

    /** 关联的订单事件卡片 ID（msg_type=event 时使用） */
    @Column(name = "event_id")
    private Long eventId;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
