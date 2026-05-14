package com.jewelry.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "order_modeling_archive")
@EntityListeners(AuditingEntityListener.class)
public class OrderModelingArchive {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false, unique = true)
    private Long orderId;

    @Column(name = "main_structure_complexity")
    private Integer mainStructureComplexity;

    @Column(name = "main_marker_file_ids", columnDefinition = "TEXT")
    private String mainMarkerFileIdsJson;

    @Column(name = "texture_complexity")
    private Integer textureComplexity;

    @Column(name = "texture_marker_file_ids", columnDefinition = "TEXT")
    private String textureMarkerFileIdsJson;

    @Column(name = "small_component_count", nullable = false)
    private Integer smallComponentCount = 0;

    @Column(name = "inlay_structure_count", nullable = false)
    private Integer inlayStructureCount = 0;

    @Column(name = "components_json", columnDefinition = "MEDIUMTEXT")
    private String componentsJson;

    @Column(name = "inlays_json", columnDefinition = "MEDIUMTEXT")
    private String inlaysJson;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "completed_by_user_id")
    private Long completedByUserId;

    @Column(name = "last_saved_by_user_id")
    private Long lastSavedByUserId;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
