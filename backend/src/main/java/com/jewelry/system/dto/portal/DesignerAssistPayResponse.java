package com.jewelry.system.dto.portal;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DesignerAssistPayResponse {
    private Long orderId;
    private String serviceType;
    private Boolean designerAssistPaid;
    private String message;
    private String assistPrice;
}
