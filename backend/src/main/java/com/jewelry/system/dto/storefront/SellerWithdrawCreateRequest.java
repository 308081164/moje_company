package com.jewelry.system.dto.storefront;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class SellerWithdrawCreateRequest {
    private BigDecimal amount;
}
