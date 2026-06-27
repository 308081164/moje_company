package com.moje.jewelry3d.model.dto;

import lombok.Data;

/**
 * 图像预处理（背景扣除）响应
 */
@Data
public class PreprocessResponse {
    private String sessionId;
    private String processedPath;
    private String previewUrl;
    private String originalPath;
}
