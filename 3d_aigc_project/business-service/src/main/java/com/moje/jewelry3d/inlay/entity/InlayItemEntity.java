package com.moje.jewelry3d.inlay.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Getter
@Setter
@Entity
@Table(name = "inlay_item")
public class InlayItemEntity {

    @Id
    @Column(length = 36)
    private String id;

    @Column(length = 64)
    private String code;

    @Column(name = "display_name", nullable = false, length = 512)
    private String displayName;

    @Column(name = "primary_format", nullable = false, length = 16)
    private String primaryFormat = "JCD";

    @Column(name = "stone_diameter_mm")
    private Float stoneDiameterMm;

    @Column(name = "inlay_type", length = 32)
    private String inlayType;

    @Column(nullable = false, length = 16)
    private String status = "active";

    @Column(name = "legacy_path", unique = true, length = 1024)
    private String legacyPath;

    @Column(name = "source_library", length = 128)
    private String sourceLibrary;

    @Column(name = "category_id", length = 36)
    private String categoryId;

    @Column(name = "mesh_ready", nullable = false)
    private boolean meshReady;

    @Column(name = "mesh_method", length = 32)
    private String meshMethod;

    @Column(name = "mesh_is_proxy", nullable = false)
    private boolean meshIsProxy;

    @Column(name = "has_preview", nullable = false)
    private boolean hasPreview;

    @Column(name = "preview_quality")
    private Float previewQuality;

    @Column(name = "preview_method", length = 32)
    private String previewMethod;

    @Column(name = "metadata_json", columnDefinition = "TEXT")
    private String metadataJson = "{}";

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "inlay_tag",
            joinColumns = @JoinColumn(name = "inlay_id"),
            inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    private Set<TagEntity> tags = new HashSet<>();

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
