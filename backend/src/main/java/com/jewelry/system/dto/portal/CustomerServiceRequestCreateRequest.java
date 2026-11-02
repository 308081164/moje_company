package com.jewelry.system.dto.portal;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class CustomerServiceRequestCreateRequest {
    /** 分类：COMPLAINT 用 QUALITY/SERVICE/DELAY/SHIPPING/OTHER；REFUND 用 CHANGE_OF_MIND/DESIGN_UNSATISFIED/DELAY/PRICE/OTHER */
    private String category;
    private String reason;
    /** 仅退款可选 */
    private BigDecimal requestedAmount;
}
