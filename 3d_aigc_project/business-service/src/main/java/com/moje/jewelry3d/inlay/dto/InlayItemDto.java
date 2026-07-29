package com.moje.jewelry3d.inlay.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class InlayItemDto {
    private String id;

    @JsonProperty("display_name")
    private String displayName;

    @JsonProperty("legacy_path")
    private String legacyPath;

    @JsonProperty("primary_format")
    private String primaryFormat;

    @JsonProperty("mesh_ready")
    private boolean meshReady;

    @JsonProperty("mesh_method")
    private String meshMethod;

    @JsonProperty("mesh_is_proxy")
    private boolean meshIsProxy;

    @JsonProperty("has_preview")
    private boolean hasPreview;

    @JsonProperty("preview_quality")
    private Float previewQuality;

    @JsonProperty("preview_method")
    private String previewMethod;

    @JsonProperty("stone_diameter_mm")
    private Float stoneDiameterMm;

    @JsonProperty("inlay_type")
    private String inlayType;

    private String status;
    private List<String> tags;
    private CategoryBrief category;

    @JsonProperty("thumbnail_url")
    private String thumbnailUrl;

    @JsonProperty("mesh_url")
    private String meshUrl;

    @JsonProperty("mesh_glb_url")
    private String meshGlbUrl;

    @JsonProperty("file_size_bytes")
    private Long fileSizeBytes;

    @JsonProperty("updated_at")
    private String updatedAt;

    @Data
    @Builder
    public static class CategoryBrief {
        private String id;
        private String name;
    }
}
