package com.jewelry.system.dto.portal;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PortalCustomerOrderCreateResponse {
    private Long orderId;
    private String orderNumber;
    private Long conversationId;
    private String serviceType;
}
