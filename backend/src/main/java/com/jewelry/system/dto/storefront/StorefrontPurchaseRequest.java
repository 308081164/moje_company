package com.jewelry.system.dto.storefront;

import lombok.Data;

@Data
public class StorefrontPurchaseRequest {
    private String customerName;
    private String customerContact;
    private String shippingAddress;
    private String note;
}
