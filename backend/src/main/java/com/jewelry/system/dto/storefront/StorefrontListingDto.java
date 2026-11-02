package com.jewelry.system.dto.storefront;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

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
    /** 详情页图集：设计图 / 建模效果图 / 实拍或参考图（仅详情接口填充） */
    private List<String> designImages;
    private List<String> modelEffectImages;
    private List<String> photoImages;
    /** 详情页：材质、电镀、克重、字印（来自源订单） */
    private String materialLabel;
    private String platingLabel;
    private String weightLabel;
    private String engravingText;
    private List<StorefrontStoneLineDto> stones;
    private List<StorefrontProcessLineDto> processes;
}
