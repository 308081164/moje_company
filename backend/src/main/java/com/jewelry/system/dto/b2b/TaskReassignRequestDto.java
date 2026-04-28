package com.jewelry.system.dto.b2b;

import lombok.Data;

@Data
public class TaskReassignRequestDto {
    
    private Long orderId;
    private String taskType;
    private Long fromUserId;
    private Long toUserId;
    private String reason;
}
