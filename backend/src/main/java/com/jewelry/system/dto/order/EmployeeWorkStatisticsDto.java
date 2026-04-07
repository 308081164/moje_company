package com.jewelry.system.dto.order;

import lombok.Builder;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 与前端 EmployeeWorkStatistics 对齐的结构。
 * 其中 averageCompletionTime/qualityScore/customerSatisfaction 目前先给默认值。
 */
@Data
@Builder
public class EmployeeWorkStatisticsDto {
    private Long employeeId;
    private String employeeName;
    private String role;
    private Long totalOrders;
    private Long completedOrders;
    private Long pendingOrders;
    private Double averageCompletionTime;
    private List<Map<String, Object>> monthlyCompletion;
    private Double qualityScore;
    private Double customerSatisfaction;

    public static EmployeeWorkStatisticsDto empty(Long employeeId, String employeeName, String role) {
        return EmployeeWorkStatisticsDto.builder()
                .employeeId(employeeId)
                .employeeName(employeeName)
                .role(role)
                .totalOrders(0L)
                .completedOrders(0L)
                .pendingOrders(0L)
                .averageCompletionTime(0d)
                .monthlyCompletion(new ArrayList<>())
                .qualityScore(100d)
                .customerSatisfaction(100d)
                .build();
    }
}

