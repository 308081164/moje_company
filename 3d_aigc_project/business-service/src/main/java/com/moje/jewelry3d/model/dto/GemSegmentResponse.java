package com.moje.jewelry3d.model.dto;

import lombok.Data;

/**
 * SAM 点选宝石蒙版预览响应
 */
@Data
public class GemSegmentResponse {
    private String sessionId;
    private Double gemCoverageRatio;
    private String maskPreviewUrl;
    private String segmentEngine;
}
