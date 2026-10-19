package com.jewelry.system.dto.referral;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class ReferralWithdrawCreateRequest {
    private BigDecimal amount;
}
