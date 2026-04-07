package com.jewelry.system.dto.order;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class OrderExportRequest {
    private List<Long> orderIds;
    private Map<String, Object> config;
}
