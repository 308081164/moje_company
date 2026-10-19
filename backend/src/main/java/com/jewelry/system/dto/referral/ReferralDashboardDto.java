package com.jewelry.system.dto.referral;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class ReferralDashboardDto {
    private String code;
    private String shareUrl;
    private String qrCodeBase64;
    private BigDecimal commissionRate;
    private BigDecimal availableBalance;
    private BigDecimal pendingBalance;
    private BigDecimal totalEarned;
    private BigDecimal totalWithdrawn;
    /** 累计绑定订单数 */
    private long boundOrderCount;
    /** 已结算佣金订单数 */
    private long settledOrderCount;
    /** 带来推广码下单的去重买家人数 */
    private long boundBuyerCount;
    private List<ReferralBindingDto> bindings;
    private List<ReferralTxnDto> txns;
    private List<ReferralWithdrawDto> withdrawals;
}
