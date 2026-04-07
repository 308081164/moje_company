package com.jewelry.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "quotation")
@EntityListeners(AuditingEntityListener.class)
public class Quotation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false, unique = true)
    private Long orderId;

    @Column(name = "labor_cost", precision = 10, scale = 2)
    private BigDecimal laborCost = BigDecimal.ZERO;

    @Column(name = "additional_labor_cost", precision = 10, scale = 2)
    private BigDecimal additionalLaborCost = BigDecimal.ZERO;

    @Column(name = "has_design_copyright")
    private Boolean hasDesignCopyright = false;

    @Column(name = "design_copyright_fee", precision = 10, scale = 2)
    private BigDecimal designCopyrightFee = BigDecimal.ZERO;

    @Column(name = "has_appraisal_certificate")
    private Boolean hasAppraisalCertificate = false;

    @Column(name = "appraisal_certificate_fee", precision = 10, scale = 2)
    private BigDecimal appraisalCertificateFee = BigDecimal.ZERO;

    @Column(name = "is_confidential")
    private Boolean confidential = false;

    @Column(name = "other_fees", precision = 10, scale = 2)
    private BigDecimal otherFees = BigDecimal.ZERO;

    @Column(name = "other_notes", columnDefinition = "TEXT")
    private String otherNotes;

    @Column(precision = 10, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(name = "total_amount", precision = 10, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "is_finalized")
    private Boolean finalized = false;

    @Column(name = "finalized_time")
    private LocalDateTime finalizedTime;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
