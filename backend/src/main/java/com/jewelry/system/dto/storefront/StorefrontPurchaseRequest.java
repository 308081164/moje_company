package com.jewelry.system.dto.storefront;

import lombok.Data;

@Data
public class StorefrontPurchaseRequest {
    private String customerName;
    private String customerContact;
    private String shippingAddress;
    private String note;
    /**
     * 通用尺寸值：戒指圈号、手镯尺寸等。
     * 项链/锁骨链也可填链长（厘米）。
     */
    private String buyerSize;
    /** 戒指圈号单位：HK / US / EU / UK / INNER_MM / OTHER */
    private String ringUnit;
    /** 项链是否配链；锁骨链默认视为配链 */
    private Boolean withChain;
    /** 配链/锁骨链样式：O / CROSS / CHOPARD … */
    private String chainStyle;
    /** 链长（选填），如 40cm、45cm */
    private String chainLength;
    /** 手镯量法：CLOSED_MM / EUROPE_CM / OPEN_WRIST_CM */
    private String braceletMeasure;
    /** 已废弃：独立站商城不支持推广码，仅珠宝定制下单使用 {@link com.jewelry.system.dto.portal.PortalCustomerOrderCreateRequest#referralCode} */
    private String referralCode;
}
