package com.jewelry.system.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 管理员视角的卖家提现申请记录（当前为模拟即时到账，只读）。
 */
@Data
@Builder
public class AdminStorefrontWithdrawalDto {
    private Long id;
    private Long accountId;
    private String sellerDisplayName;
    private BigDecimal amount;
    private String status;
    private String remark;
    private String createdAt;
}
