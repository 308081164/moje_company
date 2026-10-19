package com.jewelry.system.dto.storefront;

import lombok.Data;

@Data
public class StorefrontPurchaseRequest {
    private String customerName;
    private String customerContact;
    private String shippingAddress;
    private String note;
    /** 个人推广码（选填）：订单完成后推广人获得售价 5% 佣金 */
    private String referralCode;
}
