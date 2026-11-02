package com.jewelry.system.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** 员工端人民币报价 → 客户端美元展示的换算。 */
public final class CurrencyExchange {

    /** 默认：1 USD = 7.20 CNY（可在 system_config.fx.cnyPerUsd 覆盖）。 */
    public static final BigDecimal DEFAULT_CNY_PER_USD = new BigDecimal("7.20");

    private CurrencyExchange() {
    }

    public static BigDecimal normalizeRate(BigDecimal cnyPerUsd) {
        if (cnyPerUsd == null || cnyPerUsd.compareTo(BigDecimal.ZERO) <= 0) {
            return DEFAULT_CNY_PER_USD;
        }
        return cnyPerUsd.setScale(4, RoundingMode.HALF_UP);
    }

    public static BigDecimal cnyToUsd(BigDecimal cny, BigDecimal cnyPerUsd) {
        if (cny == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal rate = normalizeRate(cnyPerUsd);
        return cny.divide(rate, 2, RoundingMode.HALF_UP);
    }
}
