package com.jewelry.system.service;

import com.jewelry.system.dto.order.OrderStatisticsDto;
import com.jewelry.system.enums.OrderSource;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class OrderStatisticsService {

    private final OrderRepository orderRepository;

    @Transactional(readOnly = true)
    public OrderStatisticsDto statistics() {
        OrderStatisticsDto dto = new OrderStatisticsDto();
        dto.setTotalOrders(orderRepository.count());

        dto.setPendingDesignOrders(orderRepository.countByStatus(OrderStatus.PENDING_DESIGN));
        dto.setDesigningOrders(orderRepository.countByStatus(OrderStatus.DESIGNING));
        dto.setPendingModelOrders(orderRepository.countByStatus(OrderStatus.PENDING_MODEL));
        dto.setModelingOrders(orderRepository.countByStatus(OrderStatus.MODELING));
        dto.setPendingReviewOrders(orderRepository.countByStatus(OrderStatus.PENDING_REVIEW));
        dto.setReviewingOrders(0);
        dto.setPendingQuotationOrders(0);
        dto.setPendingProductionOrders(orderRepository.countByStatus(OrderStatus.PENDING_PRODUCTION));
        dto.setProducingOrders(orderRepository.countByStatus(OrderStatus.PRODUCING));
        dto.setCompletedOrders(orderRepository.countByStatus(OrderStatus.COMPLETED));
        dto.setCancelledOrders(orderRepository.countByStatus(OrderStatus.CANCELLED));

        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        LocalDateTime weekStart = LocalDate.now()
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .atStartOfDay();
        LocalDateTime monthStart = LocalDate.now().withDayOfMonth(1).atStartOfDay();

        dto.setTodayNewOrders(orderRepository.countByCreatedAtAfter(todayStart));
        dto.setWeekNewOrders(orderRepository.countByCreatedAtAfter(weekStart));
        dto.setMonthNewOrders(orderRepository.countByCreatedAtAfter(monthStart));

        BigDecimal total = nz(orderRepository.sumAllDeposit());
        BigDecimal completedDep = nz(orderRepository.sumDepositByStatus(OrderStatus.COMPLETED));
        dto.setTotalRevenue(total.doubleValue());
        dto.setCompletedRevenue(completedDep.doubleValue());
        dto.setPendingRevenue(total.subtract(completedDep).doubleValue());

        List<Map<String, Object>> srcDist = new ArrayList<>();
        for (Object[] row : orderRepository.aggregateBySource()) {
            OrderSource src = (OrderSource) row[0];
            long cnt = ((Number) row[1]).longValue();
            Object r3 = row[2];
            BigDecimal rev = r3 instanceof BigDecimal b ? b : BigDecimal.valueOf(((Number) r3).doubleValue());
            rev = nz(rev);
            Map<String, Object> m = new HashMap<>();
            m.put("source", OrderApiMapper.mapSourceToApiPublic(src));
            m.put("count", cnt);
            m.put("revenue", rev.doubleValue());
            srcDist.add(m);
        }
        dto.setSourceDistribution(srcDist);

        List<Map<String, Object>> stDist = new ArrayList<>();
        for (Object[] row : orderRepository.aggregateByStatus()) {
            OrderStatus st = (OrderStatus) row[0];
            long cnt = ((Number) row[1]).longValue();
            Map<String, Object> m = new HashMap<>();
            m.put("status", st.name());
            m.put("count", cnt);
            stDist.add(m);
        }
        dto.setStatusDistribution(stDist);
        dto.setMonthlyTrend(new ArrayList<>());
        return dto;
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }
}
