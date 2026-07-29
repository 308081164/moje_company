package com.moje.jewelry3d.inlay.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "category")
public class CategoryEntity {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "parent_id", length = 36)
    private String parentId;

    @Column(nullable = false, length = 256)
    private String name;

    @Column(length = 256)
    private String slug;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "is_system", nullable = false)
    private boolean system;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
