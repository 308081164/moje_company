package com.jewelry.system.dto.portal;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PortalShowcaseItemAdminDto {
    private long id;
    private long categoryId;
    private String categorySlug;
    private long fileId;
    private String fileUrl;
    private String fileName;
    private String fileType;
    private String caption;
    private int sortOrder;
}
