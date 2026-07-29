package com.moje.jewelry3d.inlay.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "inlay_asset")
public class InlayAssetEntity {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "inlay_id", nullable = false, length = 36)
    private String inlayId;

    @Column(name = "asset_type", nullable = false, length = 32)
    private String assetType;

    @Column(name = "storage_bucket", nullable = false, length = 64)
    private String storageBucket;

    @Column(name = "storage_key", nullable = false, length = 1024)
    private String storageKey;

    @Column(name = "content_hash", length = 64)
    private String contentHash;

    @Column(name = "size_bytes")
    private Long sizeBytes;

    @Column(nullable = false)
    private int version = 1;

    @Column(name = "preview_method", length = 32)
    private String previewMethod;

    @Column(name = "quality_score")
    private Float qualityScore;

    @Column(name = "is_current", nullable = false)
    private boolean current = true;

    @Column(name = "generated_at")
    private LocalDateTime generatedAt;
}
