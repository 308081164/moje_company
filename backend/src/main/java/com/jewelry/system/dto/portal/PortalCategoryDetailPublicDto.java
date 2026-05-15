package com.jewelry.system.dto.portal;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class PortalCategoryDetailPublicDto {
    private String slug;
    private String nameCn;
    private String nameEn;
    private String description;
    private List<PortalImageDto> items;
}
