package com.jewelry.system.entity;

import com.jewelry.system.enums.LegacyOrderSegment;
import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "legacy_order_archive")
@EntityListeners(AuditingEntityListener.class)
public class LegacyOrderArchive {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "archive_code", nullable = false, unique = true, length = 64)
    private String archiveCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "segment", nullable = false, length = 20)
    private LegacyOrderSegment segment = LegacyOrderSegment.UNKNOWN;

    @Column(name = "customer_name", length = 200)
    private String customerName;

    @Column(name = "customer_phone", length = 64)
    private String customerPhone;

    @Column(name = "customer_wechat", length = 200)
    private String customerWechat;

    @Column(name = "order_date")
    private LocalDate orderDate;

    @Column(name = "completed_date")
    private LocalDate completedDate;

    @Column(name = "style_summary", length = 500)
    private String styleSummary;

    @Column(name = "material_summary", length = 500)
    private String materialSummary;

    @Column(name = "requirements", columnDefinition = "MEDIUMTEXT")
    private String requirements;

    @Column(name = "design_notes", columnDefinition = "MEDIUMTEXT")
    private String designNotes;

    @Column(name = "modeling_notes", columnDefinition = "MEDIUMTEXT")
    private String modelingNotes;

    @Column(name = "quotation_notes", columnDefinition = "MEDIUMTEXT")
    private String quotationNotes;

    @Column(name = "attachments_json", columnDefinition = "MEDIUMTEXT")
    private String attachmentsJson;

    @Column(name = "internal_remark", columnDefinition = "MEDIUMTEXT")
    private String internalRemark;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    private User createdBy;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
