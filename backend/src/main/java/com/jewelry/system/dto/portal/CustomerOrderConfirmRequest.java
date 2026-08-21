package com.jewelry.system.dto.portal;

import lombok.Data;

@Data
public class CustomerOrderConfirmRequest {
    /** DESIGN_CONFIRM / MODEL_CONFIRM */
    private String eventType;
}
