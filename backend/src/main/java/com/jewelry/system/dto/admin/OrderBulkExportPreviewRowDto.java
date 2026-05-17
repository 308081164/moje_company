package com.jewelry.system.dto.admin;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class OrderBulkExportPreviewRowDto {
    private long orderId;
    private String orderNumber;
    private String status;
    private boolean b2b;
    private String createdAt;
    private String customerName;
    private String customerPhone;
}
