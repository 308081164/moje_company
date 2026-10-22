package com.jewelry.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "production_process_photo")
@EntityListeners(AuditingEntityListener.class)
public class ProductionProcessPhoto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "process_code", nullable = false, length = 32)
    private String processCode;

    @Column(name = "file_id", nullable = false)
    private Long fileId;

    @Column(name = "uploader_user_id", nullable = false)
    private Long uploaderUserId;

    @Column(name = "matched_order_id")
    private Long matchedOrderId;

    @Column(name = "matched_piece_id")
    private Long matchedPieceId;

    @Column(name = "matched_at")
    private LocalDateTime matchedAt;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
