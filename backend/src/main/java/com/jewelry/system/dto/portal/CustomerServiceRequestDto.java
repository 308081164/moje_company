package com.jewelry.system.dto.portal;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class CustomerServiceRequestDto {
    private Long id;
    private Long orderId;
    private String orderNumber;
    private String type;
    private String status;
    private String category;
    private String reason;
    private BigDecimal requestedAmount;
    private String staffNote;
    private String createdAt;
    private String updatedAt;
    private String resolvedAt;
}
