package com.jewelry.system.service;

import com.jewelry.system.enums.ServiceType;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;

/**
 * C 端自助下单的定金单价。实收定金 = 单价 × 件数，不采用客户端传入的金额。
 * 与 b2c-web 确认订单弹窗展示的单价一致：设计师设计 199 美元，来图定制 99 美元。
 */
public final class PortalDepositPricing {

    public static final BigDecimal DESIGNER_DESIGN_UNIT = new BigDecimal("199.00");
    public static final BigDecimal CUSTOM_IMAGE_UNIT = new BigDecimal("99.00");

    private PortalDepositPricing() {
    }

    public static BigDecimal unitPrice(ServiceType type) {
        if (type == ServiceType.DESIGNER_DESIGN) {
            return DESIGNER_DESIGN_UNIT;
        }
        if (type == ServiceType.CUSTOM_IMAGE) {
            return CUSTOM_IMAGE_UNIT;
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "该服务未配置定金单价");
    }

    public static int normalizePieceCount(Integer pieceCount) {
        int count = pieceCount == null ? 1 : pieceCount;
        if (count < 1 || count > OrderPieceService.MAX_PIECES_PER_ORDER) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "单件数量须在 1 至 " + OrderPieceService.MAX_PIECES_PER_ORDER + " 之间");
        }
        return count;
    }

    public static BigDecimal total(ServiceType type, Integer pieceCount) {
        return unitPrice(type).multiply(BigDecimal.valueOf(normalizePieceCount(pieceCount)));
    }
}
