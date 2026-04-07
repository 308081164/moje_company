package com.jewelry.system.util;

import com.jewelry.system.enums.OrderSource;

/**
 * 前端订单来源与数据库枚举映射（RECOMMEND→INFLUENCER、OTHER→DOUYIN）。
 */
public final class OrderSourceMapper {

    private OrderSourceMapper() {
    }

    public static OrderSource fromApi(String api) {
        if (api == null || api.isBlank()) {
            throw new IllegalArgumentException("订单来源不能为空");
        }
        String s = api.trim();
        if ("RECOMMEND".equalsIgnoreCase(s)) {
            return OrderSource.INFLUENCER;
        }
        if ("OTHER".equalsIgnoreCase(s)) {
            return OrderSource.DOUYIN;
        }
        return OrderSource.valueOf(s);
    }
}
