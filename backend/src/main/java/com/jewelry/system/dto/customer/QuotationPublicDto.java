package com.jewelry.system.dto.customer;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class QuotationPublicDto {
    private BigDecimal laborCost;
    private BigDecimal additionalLaborCost;
    private BigDecimal totalAmount;
    private boolean finalized;
}
