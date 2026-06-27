package com.moje.jewelry3d.model.dto;

import lombok.Data;

/**
 * 切分出的单个视图区域
 */
@Data
public class ViewCropDto {
    private String id;
    private int x;
    private int y;
    private int width;
    private int height;
    private String guess;
    private String previewUrl;
}
