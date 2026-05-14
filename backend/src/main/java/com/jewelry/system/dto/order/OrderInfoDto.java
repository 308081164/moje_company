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

    /** 企业微信进群方式 config_id */
    private String wecomJoinConfigId;
    /** 进群二维码图片 Base64 */
    private String wecomJoinQrBase64;
    /** 企微自动进群失败说明 */
    private String wecomJoinError;

    /** B2B 匿名访问令牌（「我的订单」列表用于打开 /portal/b2b/order/{token}） */
    private String b2bShareAccessToken;

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
