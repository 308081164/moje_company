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
}
