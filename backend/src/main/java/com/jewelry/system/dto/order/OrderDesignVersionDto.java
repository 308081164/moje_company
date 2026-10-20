package com.jewelry.system.dto.order;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class OrderDesignVersionDto {
    private Long id;
    private Long orderId;
    private Long pieceId;
    private Integer versionNo;
    private String label;
    private Long designerId;
    private String designerName;
    private String engravingText;
    private List<String> engravingImages;
    private String materialType;
    private String handSize;
    private String designNotes;
    private Object processInfo;
    private Object stoneInfo;
    private List<String> designImages;
    private Boolean submittedToCustomer;
    private Long createdBy;
    private String createdByName;
    private String createdAt;
}
