package com.moje.jewelry3d.inlay.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@Builder
public class InlayStatsDto {
    private long total;

    @JsonProperty("mesh_ready")
    private long meshReady;

    @JsonProperty("has_preview")
    private long hasPreview;

    @JsonProperty("by_format")
    private Map<String, Long> byFormat;

    @JsonProperty("by_preview_method")
    private Map<String, Long> byPreviewMethod;

    @JsonProperty("by_status")
    private Map<String, Long> byStatus;
}
