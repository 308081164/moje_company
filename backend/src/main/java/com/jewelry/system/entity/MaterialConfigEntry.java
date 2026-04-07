package com.jewelry.system.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "material_config")
public class MaterialConfigEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "material_name", nullable = false, length = 100)
    private String materialName;

    @Column(name = "material_code", nullable = false, length = 50)
    private String materialCode;

    @Column(name = "price_formula", length = 500)
    private String priceFormula;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "is_available")
    private Boolean available = true;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
