package com.moje.jewelry3d.model.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 多视图合一 CAD 图切分响应
 */
@Data
public class SplitMultiViewResponse {
    private String sessionId;

    private int sourceWidth;

    private int sourceHeight;

    private String sourcePreviewUrl;

    private List<ViewCropDto> crops = new ArrayList<>();
}
