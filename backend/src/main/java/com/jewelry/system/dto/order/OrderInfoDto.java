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
    /** 订单下各单件（含按件设计/建模块） */
    private java.util.List<OrderPieceDto> pieces;
    /** 工作台列表：有单件被客户驳回且尚未再次确认 */
    private Boolean pieceCustomerRevisionPending;
    /** 建模工艺/质量评审（最新一条 MODEL） */
    private OrderReviewBlockDto reviewInfo;
    /** 设计质量评审（最新一条 DESIGN） */
    private OrderReviewBlockDto designReviewInfo;
    private OrderQuotationBlockDto quotationInfo;
    /** 客户定金所选金属，以及下单后问卷 */
    private CustomerBriefViewDto customerBrief;
    /** 尾款报价是否已推送给客户（BALANCE_PAYMENT 或 quotation.finalized） */
    private Boolean balanceQuoteSent;
    /** 客户是否已支付尾款（BALANCE_PAID） */
    private Boolean balancePaid;
    /**
     * 待建模评审且跟单已通过：系统已发给客户，等待客户确认建模稿。
     */
    private Boolean awaitingCustomerModelConfirm;
    /**
     * 待设计评审且跟单已通过：系统已发给客户，等待客户确认设计稿。
     */
    private Boolean awaitingCustomerDesignConfirm;
    /** 质量审核待办类型：DESIGN / MODEL（列表用） */
    private String qualityReviewKind;
    /** 待发送生产且客户尚未付清尾款：禁止跟单转发 STL */
    private Boolean balanceUnpaidPendingProduction;
    /** 跟单「已发货」列表附带的当前物流；其它接口一般为 null。 */
    private OrderShipmentDto shipment;

    /** 企业微信进群方式 config_id */
    private String wecomJoinConfigId;
    /** 进群二维码图片 Base64 */
    private String wecomJoinQrBase64;
    /** 企微自动进群失败说明 */
    private String wecomJoinError;

    /** B2B 匿名访问令牌（「我的订单」列表用于打开 /portal/b2b/order/{token}） */
    private String b2bShareAccessToken;

    /** B2B 门户顾客视角状态文案：建模中 / 需要操作 / 已完成 / 已取消 */
    private String b2bPortalStatusLabel;
    /** 筛选用：MODELING / ACTION / DONE / CANCELLED */
    private String b2bPortalStatusBucket;
    /** B2B 门户：顾客上传参考图预览 URL（最多 6 张） */
    private java.util.List<String> b2bAttachmentPreviewUrls;

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
        private String shippingRecipient;
        private String shippingPhone;
        private String shippingCountry;
        private String shippingAddress;
        private String shippingPostalCode;
        private String serviceType;
        private Boolean designerAssistPaid;
        /** 是否已支付加急（列表置顶标识） */
        private Boolean rushPaid;
    }
}
