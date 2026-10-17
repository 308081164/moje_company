package com.jewelry.system.dto.storefront;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class StorefrontPublishRequest {
    private Long sourceOrderId;
    private String title;
    private String description;
    private BigDecimal salePrice;
}
