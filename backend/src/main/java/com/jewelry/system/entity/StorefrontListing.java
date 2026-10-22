package com.jewelry.system.entity;

import com.jewelry.system.enums.JewelryType;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "storefront_listing")
@EntityListeners(AuditingEntityListener.class)
public class StorefrontListing {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "source_order_id", nullable = false)
    private Long sourceOrderId;

    @Column(name = "seller_account_id", nullable = false)
    private Long sellerAccountId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "cover_image_url", length = 1000)
    private String coverImageUrl;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "jewelry_type", length = 32)
    private JewelryType jewelryType;

    @Column(name = "sale_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal salePrice;

    @Column(name = "production_fee_min", nullable = false, precision = 12, scale = 2)
    private BigDecimal productionFeeMin;

    @Column(name = "production_fee_max", nullable = false, precision = 12, scale = 2)
    private BigDecimal productionFeeMax;

    @Column(name = "shipping_fee_min", nullable = false, precision = 12, scale = 2)
    private BigDecimal shippingFeeMin;

    @Column(name = "shipping_fee_max", nullable = false, precision = 12, scale = 2)
    private BigDecimal shippingFeeMax;

    @Column(nullable = false, length = 20)
    private String status = "PUBLISHED";

    @Column(name = "sold_count", nullable = false)
    private Integer soldCount = 0;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
