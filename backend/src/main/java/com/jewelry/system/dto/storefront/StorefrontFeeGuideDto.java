package com.jewelry.system.dto.storefront;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class StorefrontFeeGuideDto {
    private String currency;
    private BigDecimal productionFeeMin;
    private BigDecimal productionFeeMax;
    private BigDecimal shippingFeeMin;
    private BigDecimal shippingFeeMax;
    private String note;
}
