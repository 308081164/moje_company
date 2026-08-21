package com.jewelry.system.entity;

import com.jewelry.system.security.AccountKind;
import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * 聊天室成员。建模师永不进群；成员为客户 + 售中客服 + 跟单员 + 设计师（仅设计师设计时）。
 */
@Data
@Entity
@Table(name = "conversation_member")
@EntityListeners(AuditingEntityListener.class)
public class ConversationMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;

    /** 账号类型：STAFF / B2B_CLIENT / C_PORTAL_CUSTOMER */
    @Enumerated(EnumType.STRING)
    @Column(name = "account_type", nullable = false, length = 30)
    private AccountKind accountType;

    @Column(name = "account_id", nullable = false)
    private Long accountId;

    /** 业务角色展示名：DESIGNER / SALES_MID / FOLLOW_UP / CUSTOMER 等 */
    @Column(length = 30)
    private String role;

    /** 已读游标：该成员最后已读的消息 ID */
    @Column(name = "last_read_message_id")
    private Long lastReadMessageId;

    @CreatedDate
    @Column(name = "joined_at", nullable = false, updatable = false)
    private LocalDateTime joinedAt;
}
