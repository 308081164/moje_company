package com.jewelry.system.dto.conversation;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class ConversationMessageDto {
    private Long id;
    private Long conversationId;
    private String senderType;
    private Long senderId;
    private String role;
    private String displayName;
    private String msgType;
    private String content;
    /** 按当前查看者语言生成的翻译结果 */
    private String translatedContent;
    /** 翻译目标语言（与 translatedContent 对应） */
    private String translatedLang;
    private List<Long> fileIds;
    private Long eventId;
    /** msgType=event 时携带的订单事件卡片详情 */
    private com.jewelry.system.dto.order.OrderEventDto event;
    private LocalDateTime createdAt;
}
