package com.jewelry.system.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 管理员视角的独立站卖家概览（门户账号 + 上架/销量 + 钱包聚合）。
 */
@Data
@Builder
public class AdminStorefrontSellerDto {
    private Long accountId;
    private String displayName;
    private String contact;
    private String email;
    private long listingCount;
    private long publishedCount;
    private long soldCount;
    private BigDecimal availableBalance;
    private BigDecimal pendingBalance;
    private BigDecimal totalEarned;
    private BigDecimal totalWithdrawn;
}
