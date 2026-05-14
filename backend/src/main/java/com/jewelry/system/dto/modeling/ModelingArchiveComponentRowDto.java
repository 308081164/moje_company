package com.jewelry.system.dto.modeling;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class ModelingArchiveComponentRowDto {
    /** 1 简单 2 一般复杂 3 复杂 */
    private Integer complexity;
    private List<Long> markerFileIds = new ArrayList<>();
}
