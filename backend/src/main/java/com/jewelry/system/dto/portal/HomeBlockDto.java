package com.jewelry.system.dto.portal;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@Builder
public class HomeBlockDto {
    private Long id;
    private String scope;
    private String section;
    private String blockKey;
    private int sortOrder;
    private boolean enabled;
    /** 解析后的 content_json：{ texts: {lang:text}, imageFileIds:[...], extra:{...} } */
    private Map<String, Object> content;
}
