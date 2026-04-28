package com.jewelry.system.dto.b2b;

import lombok.Data;

@Data
public class OrderRejectionRequestDto {
    
    private Long orderId;
    private String rejectionType;
    private String rejectionReasons;
}
