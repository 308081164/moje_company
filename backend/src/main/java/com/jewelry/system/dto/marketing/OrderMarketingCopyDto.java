package com.jewelry.system.dto.marketing;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class OrderMarketingCopyDto {
    private long orderId;
    private String orderNumber;
    private boolean generationComplete;
    private String xhsGrassCopy;
    private String xianyuTaobaoCopy;
    private String douyinBroadcastCopy;
    private LocalDateTime lastGeneratedAt;
    private String lastGeneratedByName;
}
