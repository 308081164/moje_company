package com.jewelry.system.dto.order;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class OrderDesignBlockDto {
    private Long id;
    private Long orderId;
    private Long designerId;
    private String designerName;
    private String engravingText;
    private String materialType;
    private String materialDetail;
    private String handSize;
    private Object processInfo;
    private Object stoneInfo;
    private String designNotes;
    private Boolean designPassed;
    private String designPassedTime;
    private String createdAt;
    private String updatedAt;
}
