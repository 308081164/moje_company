package com.jewelry.system.dto.modeling;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class ModelingArchiveDto {
    private Long orderId;
    private Integer mainStructureComplexity;
    private List<Long> mainMarkerFileIds = new ArrayList<>();
    private Integer textureComplexity;
    private List<Long> textureMarkerFileIds = new ArrayList<>();
    private Integer smallComponentCount;
    private Integer inlayStructureCount;
    private List<ModelingArchiveComponentRowDto> components = new ArrayList<>();
    private List<ModelingArchiveInlayRowDto> inlays = new ArrayList<>();
    private LocalDateTime completedAt;
    private Long completedByUserId;
    private String completedByDisplayName;
}
