package com.moje.jewelry3d.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "generate_task_asset")
public class GenerateTaskAssetEntity {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "task_id", nullable = false, length = 36)
    private String taskId;

    @Column(name = "asset_type", nullable = false, length = 32)
    private String assetType;

    @Column(name = "storage_bucket", nullable = false, length = 64)
    private String storageBucket;

    @Column(name = "storage_key", nullable = false, length = 1024)
    private String storageKey;

    @Column(name = "size_bytes")
    private Long sizeBytes;

    @Column(name = "content_type", length = 128)
    private String contentType;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
