package com.jewelry.system.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

/**
 * 只读视图：employee_work_statistics（由 Flyway V1 创建）。
 */
@Data
@Entity
@Table(name = "employee_work_statistics")
public class EmployeeWorkStatisticsView {

    @Id
    @Column(name = "user_id")
    private Long userId;

    private String username;

    @Column(name = "real_name")
    private String realName;

    /**
     * users.role 是 ENUM，映射到视图后 JDBC 类型会落在 CHAR 上。
     * Hibernate 在 ddl-auto=validate 下如果按默认 VARCHAR 校验会失败，
     * 因此这里显式按 CHAR 预期列类型。
     */
    @Column(name = "role", columnDefinition = "CHAR(20)")
    private String role;

    @Column(name = "pending_design_count")
    private Long pendingDesignCount;

    @Column(name = "designing_count")
    private Long designingCount;

    @Column(name = "pending_model_count")
    private Long pendingModelCount;

    @Column(name = "modeling_count")
    private Long modelingCount;

    @Column(name = "pending_review_count")
    private Long pendingReviewCount;

    @Column(name = "completed_this_week_count")
    private Long completedThisWeekCount;

    @Column(name = "today_new_orders")
    private Long todayNewOrders;
}

