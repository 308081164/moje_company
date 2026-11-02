package com.jewelry.system.dto.customer;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class QuotationPublicDto {
    private BigDecimal laborCost;
    private BigDecimal additionalLaborCost;
    /** 客户应付尾款（美元）。 */
    private BigDecimal totalAmount;
    /** 应付币种，尾款推送后为 USD。 */
    private String currency;
    /** 跟单人民币报价（有换算记录时返回）。 */
    private BigDecimal staffAmountCny;
    /** 换算汇率：1 USD = fxCnyPerUsd CNY。 */
    private BigDecimal fxCnyPerUsd;
    /** 优惠前美元金额。 */
    private BigDecimal amountBeforeDiscount;
    /** 公开宣传限时优惠（美元），无优惠时为 0 或 null。 */
    private BigDecimal publicityDiscountUsd;
    private boolean finalized;
    private Boolean designBuyout;
    private BigDecimal designBuyoutCost;
    private Boolean appraisalCertificate;
    private BigDecimal appraisalCertificateCost;
    private Boolean confidential;
}
