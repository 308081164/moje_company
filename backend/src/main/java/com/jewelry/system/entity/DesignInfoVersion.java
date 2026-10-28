package com.jewelry.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "design_info_version")
@EntityListeners(AuditingEntityListener.class)
public class DesignInfoVersion {

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

    @Column(name = "designer_id")
    private Long designerId;

    @Column(name = "engraving_text", length = 500)
    private String engravingText;

    @Column(name = "engraving_images", columnDefinition = "json")
    private String engravingImagesJson;

    @Column(name = "material_type", length = 50)
    private String materialType;

    @Column(name = "hand_size", length = 50)
    private String handSize;

    @Column(name = "design_notes", columnDefinition = "TEXT")
    private String designNotes;

    @Column(name = "process_info", columnDefinition = "json")
    private String processInfoJson;

    @Column(name = "stone_info", columnDefinition = "json")
    private String stoneInfoJson;

    @Column(length = 120)
    private String plating;

    @Column(name = "design_images", columnDefinition = "json")
    private String designImagesJson;

    @Column(name = "submitted_to_customer", nullable = false, columnDefinition = "TINYINT(1) DEFAULT 0")
    private boolean submittedToCustomer;

    @Column(name = "created_by")
    private Long createdBy;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
