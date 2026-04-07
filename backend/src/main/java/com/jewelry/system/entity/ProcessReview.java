package com.jewelry.system.entity;

import com.jewelry.system.enums.ReviewResult;
import jakarta.persistence.*;
import lombok.Data;

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
