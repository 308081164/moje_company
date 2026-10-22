package com.jewelry.system.dto.storefront;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class StorefrontListingDto {
    private Long id;
    private Long sourceOrderId;
    private String title;
    private String description;
    private String coverImageUrl;
    private BigDecimal salePrice;
    private BigDecimal productionFeeMin;
    private BigDecimal productionFeeMax;
    private BigDecimal shippingFeeMin;
    private BigDecimal shippingFeeMax;
    private String status;
    private Integer soldCount;
    private String createdAt;
    private String sellerDisplayName;
    /** 珠宝类型，用于商城筛选与下单规格 */
    private String jewelryType;
    /** 买家是否需填写规格（手寸/链长等） */
    private Boolean buyerSizeRequired;
    private Boolean buyerSizeVisible;
}
