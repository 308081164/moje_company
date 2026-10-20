package com.jewelry.system.dto.order;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class OrderEventDto {
    private Long id;
    private Long orderId;
    private Long pieceId;
    private String eventType;
    private String actorType;
    private Long actorId;
    private String actorRole;
    private String actorName;
    private String title;
    private String content;
    private String reason;
    private List<Long> fileIds;
    /** 关联图片 URL（设计稿 / 建模效果图等） */
    private List<String> images;
    /** 客户是否可在卡片上操作（确认/驳回），DESIGN_SUBMIT / MODEL_SUBMIT 为 true */
    private Boolean actionable;
    /** 客户已作出的决策：CONFIRM / REJECT / PAID / null（未处理） */
    private String resolution;
    /** 决策展示名：已确认 / 已驳回 / 已支付 / null */
    private String resolutionLabel;
    private LocalDateTime createdAt;
}
