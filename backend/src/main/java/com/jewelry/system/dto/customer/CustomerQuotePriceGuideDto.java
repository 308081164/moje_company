package com.jewelry.system.dto.customer;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CustomerQuotePriceGuideDto {
    private double designBuyoutPrice;
    private double certificatePrice;
}
