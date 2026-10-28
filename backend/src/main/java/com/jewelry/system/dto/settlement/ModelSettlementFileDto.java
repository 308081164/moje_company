package com.jewelry.system.dto.settlement;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ModelSettlementFileDto {
    private String name;
    private String url;
}
