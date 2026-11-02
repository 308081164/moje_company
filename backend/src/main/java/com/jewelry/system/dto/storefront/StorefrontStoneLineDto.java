package com.jewelry.system.dto.storefront;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class StorefrontStoneLineDto {
    private String stoneType;
    private String shape;
    private String size;
    private String quantity;
    private String weight;
    private String notes;
}
