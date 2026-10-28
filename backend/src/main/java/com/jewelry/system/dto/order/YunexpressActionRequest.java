package com.jewelry.system.dto.order;

import lombok.Data;

@Data
public class YunexpressActionRequest {
    private String productCode;
    private Double weightKg;
    private String remark;
}
