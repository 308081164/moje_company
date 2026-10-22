package com.jewelry.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "modeling_info_version")
@EntityListeners(AuditingEntityListener.class)
public class ModelingInfoVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "piece_id", nullable = false)
    private Long pieceId;

    @Column(name = "version_no", nullable = false)
    private Integer versionNo;

    @Column(name = "label", length = 200)
    private String label;

    @Column(name = "modeler_id")
    private Long modelerId;

    private BigDecimal weight;

    @Column(name = "model_notes", columnDefinition = "TEXT")
    private String modelNotes;

    @Column(name = "model_effect_images", columnDefinition = "json")
    private String modelEffectImagesJson;

    @Column(name = "model_files", columnDefinition = "json")
    private String modelFilesJson;

    @Column(name = "submitted_to_customer", nullable = false, columnDefinition = "TINYINT(1) DEFAULT 0")
    private boolean submittedToCustomer;

    @Column(name = "created_by")
    private Long createdBy;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
