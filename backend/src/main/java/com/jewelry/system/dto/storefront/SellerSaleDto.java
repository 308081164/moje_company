package com.jewelry.system.dto.storefront;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class SellerSaleDto {
    private Long orderId;
    private String orderNumber;
    private String listingTitle;
    private String status;
    private String statusLabel;
    private BigDecimal salePrice;
    private BigDecimal productionFee;
    private BigDecimal shippingFee;
    private BigDecimal sellerPayout;
    private String createdAt;
}
