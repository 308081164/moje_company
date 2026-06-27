package com.moje.jewelry3d.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/**
 * 镶嵌结构视图 DTO（前端兼容）
 */
@Data
public class InlayViewDto {

    private String id;

    private String filename;

    @JsonProperty("file_format")
    private String fileFormat;

    @JsonProperty("file_size")
    private long fileSize;

    @JsonProperty("created_at")
    private String createdAt;

    @JsonProperty("thumbnail_url")
    private String thumbnailUrl;

    @JsonProperty("has_preview")
    private boolean hasPreview;

    @JsonProperty("mesh_ready")
    private boolean meshReady;
}
