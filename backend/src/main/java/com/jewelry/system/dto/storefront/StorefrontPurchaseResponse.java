package com.jewelry.system.dto.storefront;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class StorefrontPurchaseResponse {
    private Long orderId;
    private String orderNumber;
    private Long conversationId;
}
