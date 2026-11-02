package com.jewelry.system.dto.portal;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RushPayResponse {
    private Long orderId;
    private Boolean rushPaid;
    private Integer priorityTier;
    private Long queueAheadCount;
    private String rushFee;
    private String message;
}
