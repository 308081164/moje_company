package com.jewelry.system.dto.portal;

import lombok.Data;

import java.util.Map;

@Data
public class HomeBlockUpsertRequest {
    /** 为空则新建，非空则更新 */
    private Long id;
    private String section;
    private String blockKey;
    private Integer sortOrder;
    private Boolean enabled;
    private Map<String, Object> content;
}
