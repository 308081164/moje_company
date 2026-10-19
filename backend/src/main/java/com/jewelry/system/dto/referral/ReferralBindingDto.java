package com.jewelry.system.dto.referral;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class ReferralBindingDto {
    private Long bindingId;
    private Long orderId;
    private String orderNumber;
    private String orderStatus;
    private String orderStatusLabel;
    private String orderSource;
    private BigDecimal orderAmount;
    private BigDecimal commissionAmount;
    /** PENDING / SETTLED / CANCELLED */
    private String status;
    private String createdAt;
    private String settledAt;
}
