package com.jewelry.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "order_production_follow_log")
@EntityListeners(AuditingEntityListener.class)
public class OrderProductionFollowLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "author_user_id", nullable = false)
    private Long authorUserId;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(name = "image_file_ids_json", columnDefinition = "TEXT")
    private String imageFileIdsJson;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
