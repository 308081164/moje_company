package com.jewelry.system.dto.portal;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PortalImageDto {
    private long fileId;
    private String url;
    private String caption;
}
