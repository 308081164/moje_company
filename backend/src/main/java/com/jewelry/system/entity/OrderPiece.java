package com.jewelry.system.entity;

import com.jewelry.system.enums.JewelryType;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "order_piece")
@EntityListeners(AuditingEntityListener.class)
public class OrderPiece {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(nullable = false)
    private Integer seq;

    @Column(nullable = false, length = 50)
    private String name;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "jewelry_type", length = 32)
    private JewelryType jewelryType;

    @Column(name = "design_confirmed", nullable = false)
    private Boolean designConfirmed = false;

    @Column(name = "model_confirmed", nullable = false)
    private Boolean modelConfirmed = false;

    @Column(name = "reference_images", columnDefinition = "json")
    private String referenceImagesJson;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
