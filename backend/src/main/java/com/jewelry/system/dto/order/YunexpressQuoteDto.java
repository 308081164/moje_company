package com.jewelry.system.dto.order;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class YunexpressQuoteDto {
    private String productCode;
    private String productName;
    private String currency;
    private String amount;
    private String intervalDay;
}
