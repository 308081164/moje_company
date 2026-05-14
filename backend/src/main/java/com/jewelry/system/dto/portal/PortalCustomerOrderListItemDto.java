package com.jewelry.system.dto.portal;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PortalCustomerOrderListItemDto {
    private Long orderId;
    private String orderNumber;
    private String displayTitle;
    private String currentStatus;
    private String currentStatusLabel;
    private String createdAt;
}
