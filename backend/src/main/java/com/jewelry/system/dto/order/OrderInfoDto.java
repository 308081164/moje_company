package com.jewelry.system.dto.order;

import lombok.Builder;
import lombok.Data;

/**
 * 与前端 OrderInfo 对齐的简化结构（列表/详情共用，未填充的块可为 null）。
 */
@Data
@Builder
public class OrderInfoDto {

    private OrderBaseDto baseInfo;
    private String currentStatus;
    private Long assignedSalesId;
    private String assignedSalesName;
    private String createdAt;
    private String updatedAt;

    private OrderDesignBlockDto designInfo;
    private OrderModelBlockDto modelInfo;
    private OrderReviewBlockDto reviewInfo;
    private OrderQuotationBlockDto quotationInfo;

    @Data
    @Builder
    public static class OrderBaseDto {
        private Long id;
        private String orderNumber;
        private String source;
        private String sourceDetail;
        private Double depositAmount;
        private String basicRequirements;
        private String orderTime;
        private String style;
        private String materialInfo;
        private String customerContact;
        private String customerName;
        private String customerWechat;
    }
}
