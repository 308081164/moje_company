package com.jewelry.system.dto.order;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class OrderBatchDeleteRequest {
    @NotEmpty
    private List<Long> orderIds;
}
