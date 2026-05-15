package com.jewelry.system.dto.portal;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class PortalShowcaseItemAddRequest {
    @NotNull
    private Long categoryId;
    @NotNull
    private Long fileId;
    private String caption;
    private Integer sortOrder;
}
