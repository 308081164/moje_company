package com.jewelry.system.service;

import com.jewelry.system.dto.order.EmployeeWorkStatisticsDto;
import com.jewelry.system.entity.EmployeeWorkStatisticsView;
import com.jewelry.system.repository.EmployeeWorkStatisticsViewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EmployeeStatisticsService {

    private final EmployeeWorkStatisticsViewRepository employeeWorkStatisticsViewRepository;

    @Transactional(readOnly = true)
    public List<EmployeeWorkStatisticsDto> list(Long employeeId) {
        if (employeeId != null) {
            return employeeWorkStatisticsViewRepository.findById(employeeId)
                    .map(v -> List.of(toDto(v)))
                    .orElseGet(List::of);
        }
        return employeeWorkStatisticsViewRepository.findAll().stream().map(this::toDto).toList();
    }

    private EmployeeWorkStatisticsDto toDto(EmployeeWorkStatisticsView v) {
        String name = (v.getRealName() != null && !v.getRealName().isBlank()) ? v.getRealName() : v.getUsername();
        long pending = nz(v.getPendingDesignCount())
                + nz(v.getDesigningCount())
                + nz(v.getPendingModelCount())
                + nz(v.getModelingCount())
                + nz(v.getPendingReviewCount());
        long completed = nz(v.getCompletedThisWeekCount());
        long total = pending + completed;
        return EmployeeWorkStatisticsDto.builder()
                .employeeId(v.getUserId())
                .employeeName(name)
                .role(v.getRole())
                .totalOrders(total)
                .completedOrders(completed)
                .pendingOrders(pending)
                .averageCompletionTime(0d)
                .monthlyCompletion(List.of())
                .qualityScore(100d)
                .customerSatisfaction(100d)
                .build();
    }

    private static long nz(Long v) {
        return v != null ? v : 0L;
    }
}

