package com.jewelry.system.dto.referral;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class ReferralTxnDto {
    private Long id;
    private Long orderId;
    /** HOLD / SETTLE / WITHDRAW */
    private String type;
    private BigDecimal amount;
    private String remark;
    private String createdAt;
}
