package com.jewelry.system.dto.order;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CustomerSubmitSpecItemDto {
    private String label;
    private String value;
}
