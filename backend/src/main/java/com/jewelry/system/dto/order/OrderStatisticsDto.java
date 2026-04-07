package com.jewelry.system.dto.order;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data
public class OrderStatisticsDto {
    private long totalOrders;
    private long pendingDesignOrders;
    private long designingOrders;
    private long pendingModelOrders;
    private long modelingOrders;
    private long pendingReviewOrders;
    private long reviewingOrders;
    private long pendingQuotationOrders;
    private long pendingProductionOrders;
    private long producingOrders;
    private long completedOrders;
    private long cancelledOrders;
    private long todayNewOrders;
    private long weekNewOrders;
    private long monthNewOrders;
    private double totalRevenue;
    private double pendingRevenue;
    private double completedRevenue;
    private List<Map<String, Object>> sourceDistribution = new ArrayList<>();
    private List<Map<String, Object>> statusDistribution = new ArrayList<>();
    private List<Map<String, Object>> monthlyTrend = new ArrayList<>();
}
