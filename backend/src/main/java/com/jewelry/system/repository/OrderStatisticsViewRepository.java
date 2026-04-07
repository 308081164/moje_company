package com.jewelry.system.repository;

import com.jewelry.system.entity.OrderStatisticsView;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface OrderStatisticsViewRepository extends JpaRepository<OrderStatisticsView, java.time.LocalDate> {

    interface MonthlyTrendRow {
        String getMonth();

        Long getCount();

        java.math.BigDecimal getRevenue();
    }

    @Query(value = """
            SELECT DATE_FORMAT(order_date, '%Y-%m') AS month,
                   SUM(total_orders) AS count,
                   COALESCE(SUM(total_deposit), 0) AS revenue
            FROM order_statistics
            GROUP BY DATE_FORMAT(order_date, '%Y-%m')
            ORDER BY month
            """, nativeQuery = true)
    List<MonthlyTrendRow> monthlyTrend();
}

