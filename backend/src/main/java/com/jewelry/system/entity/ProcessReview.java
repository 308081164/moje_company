package com.jewelry.system.entity;

import com.jewelry.system.enums.ReviewKind;
import com.jewelry.system.enums.ReviewResult;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "process_review")
public class ProcessReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    /** 按件评审时的单件；空表示整单兼容记录 */
    @Column(name = "piece_id")
    private Long pieceId;

    /** DESIGN=设计质量评审；MODEL=建模工艺评审（库列为 VARCHAR，避免 Hibernate 校验成 MySQL ENUM） */
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "review_kind", length = 20, nullable = false)
    private ReviewKind reviewKind = ReviewKind.MODEL;

    @Column(name = "reviewer_id", nullable = false)
    private Long reviewerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "review_result", length = 20)
    private ReviewResult reviewResult;

    @Column(name = "rejected_reasons", columnDefinition = "TEXT")
    private String rejectedReasons;

    @Column(name = "review_notes", columnDefinition = "TEXT")
    private String reviewNotes;

    @Column(name = "deleted_processes", columnDefinition = "json")
    private String deletedProcessesJson;

    @Column(name = "review_time")
    private LocalDateTime reviewTime = LocalDateTime.now();
}
