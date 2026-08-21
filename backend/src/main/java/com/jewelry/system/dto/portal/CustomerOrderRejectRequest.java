package com.jewelry.system.dto.portal;

import lombok.Data;

@Data
public class CustomerOrderRejectRequest {
    /** DESIGN_REJECT / MODEL_REJECT */
    private String eventType;
    private String reason;
}
