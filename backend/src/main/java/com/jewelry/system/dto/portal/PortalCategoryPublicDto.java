package com.jewelry.system.dto.portal;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class PortalCategoryPublicDto {
    private String slug;
    private String nameCn;
    private String nameEn;
    private String description;
    private String coverUrl;
    private long visibleItemCount;
    /** 首页缩略预览（最多 6 张） */
    private List<PortalImageDto> preview;
}
