package com.jewelry.system.dto.conversation;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class ConversationDto {
    private Long id;
    private Long orderId;
    private String orderNumber;
    private String title;
    /** 订单当前流程状态码（OrderStatus.name()） */
    private String orderStatus;
    /** 订单当前流程状态展示名（如「设计中」「生产中」） */
    private String orderStatusLabel;
    /** 订单服务类型（ServiceType.name()：CUSTOM_IMAGE / DESIGNER_DESIGN / B2B_MODEL） */
    private String serviceType;
    /** 订单服务类型展示名（来图定制 / 设计师设计 / B端建模订单） */
    private String serviceTypeLabel;
    /** 会话头像图（来图定制=参考图第一张；设计师设计=最新设计稿第一张；无则 null 用默认） */
    private String avatarUrl;
    private String lastMessage;
    private LocalDateTime lastMessageAt;
    private long unreadCount;
    private LocalDateTime createdAt;
}
