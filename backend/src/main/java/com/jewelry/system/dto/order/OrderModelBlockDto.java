package com.jewelry.system.dto.order;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class OrderModelBlockDto {
    private Long id;
    private Long orderId;
    private Long modelerId;
    private String modelerName;
    private Double weight;
    private Object modelFiles;
    private String modelNotes;
    private Boolean modelPassed;
    private String modelPassedTime;
    private String createdAt;
    private String updatedAt;
}
