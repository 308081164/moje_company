package com.jewelry.system.dto.b2b;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class OrderRejectionFlowDto {
    
    private Long id;
    private Long orderId;
    private String rejectedBy;
    private String rejectionType;
    private String rejectionReasons;
    private String currentStage;
    private String lastStatusUpdateBy;
    private LocalDateTime lastStatusUpdateAt;
    private LocalDateTime resubmittedAt;
    private LocalDateTime resolvedAt;
    private LocalDateTime createdAt;
}
