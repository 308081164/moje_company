package com.jewelry.system.dto.storefront;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class SellerDashboardDto {
    private BigDecimal availableBalance;
    private BigDecimal pendingBalance;
    private BigDecimal totalEarned;
    private BigDecimal totalWithdrawn;
    private int listingCount;
    private int soldCount;
    private List<StorefrontListingDto> listings;
    private List<SellerSaleDto> recentSales;
    private List<SellerWithdrawDto> withdrawals;
    private StorefrontFeeGuideDto feeGuide;
}
