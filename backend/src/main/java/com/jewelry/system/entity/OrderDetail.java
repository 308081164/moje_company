package com.jewelry.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "order_details")
@EntityListeners(AuditingEntityListener.class)
public class OrderDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "engraving_text", length = 500)
    private String engravingText;

    @Column(name = "material_type", length = 50)
    private String materialType;

    @Column(name = "material_weight", precision = 10, scale = 3)
    private BigDecimal materialWeight;

    @Column(name = "material_unit_price", precision = 10, scale = 2)
    private BigDecimal materialUnitPrice;

    @Column(name = "material_total_price", precision = 10, scale = 2)
    private BigDecimal materialTotalPrice;

    @Column(name = "hand_size", length = 50)
    private String handSize;

    @Column(name = "chain_length", length = 50)
    private String chainLength;

    @Column(name = "design_notes", columnDefinition = "TEXT")
    private String designNotes;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
