package com.jewelry.system.dto.b2b;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class OrderStatisticsOverviewDto {
    
    // 整体统计
    private Long totalOrders;
    private Long completedOrders;
    private Long pendingOrders;
    private Double totalRevenue;
    
    // C端统计
    private Long c2cTotalOrders;
    private Long c2cCompletedOrders;
    private Long c2cPendingOrders;
    private Double c2cRevenue;
    
    // B端统计
    private Long b2bTotalOrders;
    private Long b2bCompletedOrders;
    private Long b2bPendingOrders;
    private Double b2bRevenue;
    
    // 今日统计
    private Long todayNewOrders;
    private Long todayCompletedOrders;
}
