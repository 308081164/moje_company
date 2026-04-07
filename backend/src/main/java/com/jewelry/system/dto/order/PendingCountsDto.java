package com.jewelry.system.dto.order;

import lombok.Data;

@Data
public class PendingCountsDto {
    private long pendingDesign;
    private long pendingModel;
    private long pendingReview;
    private long pendingQuotation;
    private long pendingProduction;
    private long totalPending;
}
