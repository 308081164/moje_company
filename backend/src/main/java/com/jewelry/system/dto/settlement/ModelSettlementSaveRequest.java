package com.jewelry.system.dto.settlement;

import lombok.Data;

@Data
public class ModelSettlementSaveRequest {
    private String structureComplexity;
    private String textureLevel;
    private Integer simpleComponentCount;
    private Integer regularCurveComponentCount;
    private Integer irregularCurveComponentCount;
    private Integer highDetailComponentCount;
    private Integer simpleInlayCount;
    private Integer specialInlayCount;
    private Integer linearStoneCount;
    private Integer freeformStoneCount;
    private String note;
}
