package com.jewelry.system.service;

import com.jewelry.system.entity.Quotation;
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
    /** 生产选项「保密不对外宣传」选「否」（允许宣传）时，尾款限时减免金额（USD）。 */
    public static final BigDecimal PUBLICITY_ALLOW_DISCOUNT_USD = new BigDecimal("15.00");

    private PortalDepositPricing() {
    }

    /** 客户已填生产选项且明确选择不保密时，可享公开宣传限时优惠。 */
    public static boolean qualifiesPublicityDiscount(Quotation quotation) {
        return quotation != null
                && quotation.getDesignOptionsAt() != null
                && !Boolean.TRUE.equals(quotation.getConfidential());
    }

    public static BigDecimal applyPublicityDiscount(BigDecimal amount, Quotation quotation) {
        if (amount == null) {
            return BigDecimal.ZERO;
        }
        if (!qualifiesPublicityDiscount(quotation)) {
            return amount;
        }
        BigDecimal next = amount.subtract(PUBLICITY_ALLOW_DISCOUNT_USD);
        return next.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : next;
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
