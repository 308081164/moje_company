package com.jewelry.system.dto.modeling;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class ModelingArchiveInlayRowDto {
    /** 1 简单常规 2 特殊简单 3 特殊复杂 */
    private Integer complexity;
    private List<Long> markerFileIds = new ArrayList<>();
}
