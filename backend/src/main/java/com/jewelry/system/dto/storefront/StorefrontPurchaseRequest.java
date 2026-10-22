package com.jewelry.system.dto.storefront;

import lombok.Data;

@Data
public class StorefrontPurchaseRequest {
    private String customerName;
    private String customerContact;
    private String shippingAddress;
    private String note;
    /** 买家手寸/链长等（戒指必填） */
    private String buyerSize;
    /** 已废弃：独立站商城不支持推广码，仅珠宝定制下单使用 {@link com.jewelry.system.dto.portal.PortalCustomerOrderCreateRequest#referralCode} */
    private String referralCode;
}
