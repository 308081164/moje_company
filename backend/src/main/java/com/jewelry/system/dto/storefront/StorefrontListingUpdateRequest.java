package com.jewelry.system.dto.storefront;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 卖家编辑自己寄售商品的可改字段（均为可选，传了才改）。
 */
@Data
public class StorefrontListingUpdateRequest {
    private String title;
    private String description;
    private BigDecimal salePrice;
    private String coverImageUrl;
}
