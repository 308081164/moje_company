package com.jewelry.system.service;

import com.jewelry.system.dto.order.OrderInfoDto;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.User;
import com.jewelry.system.enums.OrderSource;

import java.time.format.DateTimeFormatter;

public final class OrderApiMapper {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private OrderApiMapper() {
    }

    public static OrderInfoDto toOrderInfo(Order o) {
        String sourceApi = mapSourceToApiPublic(o.getSource());
        String contact = firstNonBlank(o.getCustomerPhone(), o.getCustomerWechat(), "");
        OrderInfoDto.OrderBaseDto base = OrderInfoDto.OrderBaseDto.builder()
                .id(o.getId())
                .orderNumber(o.getOrderNumber())
                .source(sourceApi)
                .sourceDetail(o.getInfluencerName())
                .depositAmount(o.getDeposit() != null ? o.getDeposit().doubleValue() : 0d)
                .basicRequirements(o.getBasicRequirements())
                .orderTime(o.getOrderTime() != null ? ISO.format(o.getOrderTime()) : null)
                .style(o.getStyleInfo())
                .materialInfo(o.getMaterialInfo())
                .customerContact(contact)
                .customerName(o.getCustomerName())
                .customerWechat(o.getCustomerWechat())
                .build();

        User salesMid = o.getSalesMid();
        String salesName = null;
        if (salesMid != null) {
            salesName = salesMid.getRealName() != null && !salesMid.getRealName().isBlank()
                    ? salesMid.getRealName()
                    : salesMid.getUsername();
        }
        return OrderInfoDto.builder()
                .baseInfo(base)
                .currentStatus(o.getStatus() != null ? o.getStatus().name() : null)
                .assignedSalesId(salesMid != null ? salesMid.getId() : null)
                .assignedSalesName(salesName)
                .createdAt(o.getCreatedAt() != null ? ISO.format(o.getCreatedAt()) : null)
                .updatedAt(o.getUpdatedAt() != null ? ISO.format(o.getUpdatedAt()) : null)
                .designInfo(null)
                .modelInfo(null)
                .reviewInfo(null)
                .quotationInfo(null)
                .build();
    }

    /** 供订单列表/统计等复用，将数据库来源枚举转为前端枚举名。 */
    public static String mapSourceToApiPublic(OrderSource s) {
        if (s == null) {
            return null;
        }
        if (s == OrderSource.INFLUENCER) {
            return "RECOMMEND";
        }
        return s.name();
    }

    private static String firstNonBlank(String a, String b, String defaultVal) {
        if (a != null && !a.isBlank()) {
            return a;
        }
        if (b != null && !b.isBlank()) {
            return b;
        }
        return defaultVal;
    }
}
