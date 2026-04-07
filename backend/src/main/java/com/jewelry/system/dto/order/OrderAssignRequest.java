package com.jewelry.system.dto.order;

import lombok.Data;

@Data
public class OrderAssignRequest {
    private Long salesId;
    private Long designerId;
    private Long modelerId;
    private Long trackerId;
}
