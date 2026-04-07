package com.jewelry.system.dto.order;

import lombok.Data;

@Data
public class WeekProcessedDto {
    private long processedOrders;
    private long completedOrders;
    private double averageProcessingTime;
}
