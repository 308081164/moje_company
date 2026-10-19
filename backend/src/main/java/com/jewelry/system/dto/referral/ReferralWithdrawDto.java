package com.jewelry.system.dto.referral;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class ReferralWithdrawDto {
    private Long id;
    private BigDecimal amount;
    private String status;
    private String remark;
    private String createdAt;
}
