package com.jewelry.system.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 只读视图：order_statistics（由 Flyway V1 创建，按天聚合）。
 */
@Data
@Entity
@Table(name = "order_statistics")
public class OrderStatisticsView {

    @Id
    @Column(name = "order_date")
    private LocalDate orderDate;

    @Column(name = "total_orders")
    private Long totalOrders;

    @Column(name = "pending_design")
    private Long pendingDesign;

    private Long designing;

    @Column(name = "pending_model")
    private Long pendingModel;

    private Long modeling;

    @Column(name = "pending_review")
    private Long pendingReview;

    @Column(name = "pending_production")
    private Long pendingProduction;

    private Long producing;

    private Long completed;

    private Long cancelled;

    @Column(name = "total_deposit")
    private BigDecimal totalDeposit;
}

