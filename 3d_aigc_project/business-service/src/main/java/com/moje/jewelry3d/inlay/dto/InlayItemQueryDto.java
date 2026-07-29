package com.moje.jewelry3d.inlay.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class InlayItemQueryDto {
    private String q;
    private String categoryId;
    private String tags;
    private String inlayType;
    private Boolean meshReady;
    private Boolean hasPreview;
    private String previewMethod;
    private Float stoneDiameterMin;
    private Float stoneDiameterMax;
    private String status;
    private String sort;
    private int page;
    private int pageSize;
    private String legacyPath;
}
