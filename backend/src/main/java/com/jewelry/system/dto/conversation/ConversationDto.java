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
    /**
     * 退款标签状态：REQUESTED（客户申请退款）/ REFUNDED（已退款）；
     * 无进行中或已成功退款时为 null（驳回后恢复显示订单状态）。
     */
    private String refundStatus;
    /** 退款标签文案：客户申请退款 / 已退款 */
    private String refundStatusLabel;
    /** 是否已加急（员工会话列表置顶） */
    private Boolean rushPaid;
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
