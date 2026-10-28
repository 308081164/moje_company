package com.jewelry.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "piece_model_settlement")
@EntityListeners(AuditingEntityListener.class)
public class PieceModelSettlement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "piece_id", nullable = false, unique = true)
    private Long pieceId;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "structure_complexity", length = 64)
    private String structureComplexity;

    @Column(name = "texture_level", length = 32)
    private String textureLevel;

    @Column(name = "simple_component_count", nullable = false)
    private Integer simpleComponentCount = 0;

    @Column(name = "regular_curve_component_count", nullable = false)
    private Integer regularCurveComponentCount = 0;

    @Column(name = "irregular_curve_component_count", nullable = false)
    private Integer irregularCurveComponentCount = 0;

    @Column(name = "high_detail_component_count", nullable = false)
    private Integer highDetailComponentCount = 0;

    @Column(name = "simple_inlay_count", nullable = false)
    private Integer simpleInlayCount = 0;

    @Column(name = "special_inlay_count", nullable = false)
    private Integer specialInlayCount = 0;

    @Column(name = "linear_stone_count", nullable = false)
    private Integer linearStoneCount = 0;

    @Column(name = "freeform_stone_count", nullable = false)
    private Integer freeformStoneCount = 0;

    @Column(nullable = false)
    private Integer coefficient = 10;

    @Column(length = 500)
    private String note;

    @Column(name = "reviewer_id")
    private Long reviewerId;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
