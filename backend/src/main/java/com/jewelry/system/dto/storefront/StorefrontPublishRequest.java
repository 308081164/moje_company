package com.jewelry.system.dto.storefront;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class StorefrontPublishRequest {
    private Long sourceOrderId;
    private String title;
    private String description;
    private BigDecimal salePrice;
    /** 卖家从作品图片中选定的店铺主图；为空时由系统挑选。 */
    private String coverImageUrl;
}
