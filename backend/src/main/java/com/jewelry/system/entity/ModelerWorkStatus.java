package com.jewelry.system.entity;

import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "modeler_work_status")
@EntityListeners(AuditingEntityListener.class)
public class ModelerWorkStatus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private WorkMode workMode = WorkMode.AUTO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private WorkStatus status = WorkStatus.AVAILABLE;

    @Column(name = "todo_count", nullable = false)
    private Integer todoCount = 0;

    @Column(name = "c2c_todo_count", nullable = false)
    private Integer c2cTodoCount = 0;

    @Column(name = "b2b_todo_count", nullable = false)
    private Integer b2bTodoCount = 0;

    @Column(name = "auto_assign_enabled", nullable = false)
    private Boolean autoAssignEnabled = true;

    @Column(name = "last_priority_bonus_time")
    private LocalDateTime lastPriorityBonusTime;

    @Column(name = "reason_for_pause", length = 500)
    private String reasonForPause;

    @Column(name = "last_activity_time")
    private LocalDateTime lastActivityTime;

    @Column(name = "pause_reason", length = 500)
    private String pauseReason;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum WorkMode {
        AUTO, B2B_ONLY, C2C_ONLY
    }

    public enum WorkStatus {
        AVAILABLE, PAUSED, BUSY, OVERLOADED
    }
}