package com.jewelry.system.dto.settlement;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ModelSettlementItemDto {
    private Long pieceId;
    private Long orderId;
    private String orderNumber;
    private String orderStatus;
    private String pieceName;
    private Integer pieceSeq;
    private String jewelryType;
    private Long modelerId;
    private String modelerName;
    private String modeledAt;
    private Boolean modelConfirmed;
    private Double weight;
    private String modelNotes;
    private List<String> designImages;
    private List<String> modelEffectImages;
    private List<ModelSettlementFileDto> modelFiles;
    private List<String> processes;
    private List<String> stones;
    private boolean reviewed;
    private String structureComplexity;
    private String textureLevel;
    private int simpleComponentCount;
    private int regularCurveComponentCount;
    private int irregularCurveComponentCount;
    private int highDetailComponentCount;
    private int simpleInlayCount;
    private int specialInlayCount;
    private int linearStoneCount;
    private int freeformStoneCount;
    private int coefficient;
    private String note;
    private String reviewedAt;
}
