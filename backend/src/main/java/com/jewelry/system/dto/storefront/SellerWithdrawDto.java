package com.jewelry.system.dto.storefront;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class SellerWithdrawDto {
    private Long id;
    private BigDecimal amount;
    private String status;
    private String remark;
    private String createdAt;
}
