package com.jewelry.system.dto.order;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class OrderReviewBlockDto {
    private Long id;
    private Long orderId;
    private Long trackerId;
    private String trackerName;
    private String reviewNotes;
    private List<String> rejectedProcesses;
    private String rejectionReason;
    private Boolean reviewPassed;
    private String reviewPassedTime;
    private String createdAt;
    private String updatedAt;
}
