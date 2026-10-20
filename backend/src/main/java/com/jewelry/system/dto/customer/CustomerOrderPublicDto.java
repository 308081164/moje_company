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

    /** 建模源文件下载（文件名 + URL 列表） */
    private List<ModelFilePublicDto> modelFiles;

    /** 物流信息（未发货为 null） */
    private OrderShipmentDto shipment;

    /** 服务类型：CUSTOM_IMAGE / DESIGNER_DESIGN / B2B_MODEL / STOREFRONT */
    private String serviceType;

    /** 当前账号是否可将此订单一键上架到独立站 */
    private Boolean canPublishToStorefront;

    /** 寄售买家实付售价（非寄售单为 null） */
    private BigDecimal salePrice;

    /** 按件进度（设计/建模确认与图片） */
    private List<CustomerOrderPublicPieceDto> pieces;
}
