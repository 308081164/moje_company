package com.jewelry.system.dto.customer;

import com.jewelry.system.dto.order.OrderShipmentDto;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * C 端公开订单进度摘要（无敏感联系方式；客户姓名可选脱敏）。
 */
@Data
@Builder
public class CustomerOrderPublicDto {
    private String orderNumber;
    /** 展示用标题：款式 / 需求摘要 / 订单号兜底 */
    private String displayTitle;
    /** 脱敏姓名，可为 null */
    private String customerNameMasked;
    private String createdAt;
    private String currentStatus;
    private String currentStatusLabel;
    private String firstDesignImageUrl;
    private List<CustomerOrderPublicMilestoneDto> milestones;

    /** 客户是否已确认设计稿 */
    private Boolean designApproved;
    /** 客户是否已确认建模稿 */
    private Boolean modelApproved;

    /** 报价（已 finalize 才返回；未报价为 null） */
    private QuotationPublicDto quotation;

    /** 建模已全部确认且售中已录入基础费用，等待客户选择买断/证书/保密等 */
    private Boolean awaitingCustomerQuoteOptions;

    /** 建模已确认但售中尚未录入克重等费用 */
    private Boolean waitingStaffBaseQuote;

    /** 客户可选增值项参考价（系统配置） */
    private CustomerQuotePriceGuideDto priceGuide;

    /** 建模源文件下载（文件名 + URL 列表） */
    private List<ModelFilePublicDto> modelFiles;

    /** 物流信息（未发货为 null） */
    private OrderShipmentDto shipment;

    /** 服务类型：CUSTOM_IMAGE / DESIGNER_DESIGN / B2B_MODEL / STOREFRONT */
    private String serviceType;

    /** 来图定制客户已支付设计师协助费用并转为设计师设计 */
    private Boolean designerAssistPaid;

    /** 当前账号是否可将此订单一键上架到独立站 */
    private Boolean canPublishToStorefront;

    /** 寄售买家实付售价（非寄售单为 null） */
    private BigDecimal salePrice;

    /** 订单定金（已支付） */
    private BigDecimal deposit;

    /** 建议全额退款金额（定金 + 已付协助费 + 已付尾款） */
    private BigDecimal refundableAmount;

    /** 是否在设计/建模排队中 */
    private Boolean inQueue;
    /** 前方还有多少单在等待处理 */
    private Long queueAheadCount;
    /** 是否已支付加急 */
    private Boolean rushPaid;
    /** 是否可支付加急 */
    private Boolean rushEligible;
    /** 加急费用（USD 字符串，如 50） */
    private String rushFee;

    /** 按件进度（设计/建模确认与图片） */
    private List<CustomerOrderPublicPieceDto> pieces;

    /** 定制问卷是否已提交 */
    private Boolean briefCompleted;

    /** Workspace 顶部条阶段：NEED_BRIEF / QUEUED / DESIGNING / MODELING / PRODUCING / NONE */
    private String bannerPhase;

    /** 是否已填写收货地址（尾款前需确认） */
    private Boolean shippingAddressReady;
}
