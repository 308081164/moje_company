package com.jewelry.system.dto.portal;

import lombok.Data;

@Data
public class PortalJewelryCategoryRequest {
    private String slug;
    private String nameCn;
    private String nameEn;
    private String description;
    private Integer sortOrder;
    private Boolean enabled;
}
