package com.jewelry.system.dto.order;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class OrderModelVersionDto {
    private Long id;
    private Long orderId;
    private Long pieceId;
    private Integer versionNo;
    private String label;
    private Long modelerId;
    private String modelerName;
    private Double weight;
    private String modelNotes;
    private List<String> modelEffectImages;
    private Object modelFiles;
    private Boolean submittedToCustomer;
    private Long createdBy;
    private String createdByName;
    private String createdAt;
}
