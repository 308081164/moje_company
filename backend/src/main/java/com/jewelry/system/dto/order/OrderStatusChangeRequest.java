package com.jewelry.system.dto.order;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class OrderStatusChangeRequest {
    @NotBlank
    private String status;
    private String notes;
}
