package com.jewelry.system.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 管理员视角的独立站商城订单（source=MARKETPLACE 的买家复产单）。
 */
@Data
@Builder
public class AdminStorefrontOrderDto {
    private Long orderId;
    private String orderNumber;
    private String buyerName;
    private Long listingId;
    private String listingTitle;
    private Long sellerAccountId;
    private String sellerDisplayName;
    private BigDecimal salePrice;
    private BigDecimal productionFee;
    private BigDecimal shippingFee;
    private BigDecimal sellerPayout;
    private String status;
    private String statusLabel;
    private String orderTime;
    private String createdAt;
}
