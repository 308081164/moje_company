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
    /** 宝石区域占前景比例 0~1 */
    private Double gemCoverageRatio;
    private String gemPreset;
    /** 分割方式 hsv / sam2 / sam1 */
    private String segmentMethod;
    /** 重绘方式 ip2p */
    private String repaintMethod;
    /** SAM 蒙版叠加预览 */
    private String maskPreviewUrl;
}
