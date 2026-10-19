package com.jewelry.system.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 管理员视角的独立站商城商品（含卖家信息，归属无关）。
 */
@Data
@Builder
public class AdminStorefrontListingDto {
    private Long id;
    private Long sourceOrderId;
    private String title;
    private String description;
    private String coverImageUrl;
    private BigDecimal salePrice;
    private String status;
    private Integer soldCount;
    private String createdAt;
    private String updatedAt;
    private Long sellerAccountId;
    private String sellerDisplayName;
    private String sellerContact;
}
