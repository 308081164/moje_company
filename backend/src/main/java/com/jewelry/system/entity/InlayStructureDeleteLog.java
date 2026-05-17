package com.jewelry.system.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "inlay_structure_delete_log")
public class InlayStructureDeleteLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "oss_object_key", nullable = false, length = 1024)
    private String ossObjectKey;

    @Column(name = "deleted_at", nullable = false)
    private LocalDateTime deletedAt = LocalDateTime.now();
}
