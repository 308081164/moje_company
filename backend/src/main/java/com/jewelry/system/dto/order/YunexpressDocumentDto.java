package com.jewelry.system.dto.order;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class YunexpressDocumentDto {
    private String url;
    private String labelType;
}
