package com.jewelry.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * 门户首页区块配置（B/C 端），content_json 存多语言文案 + 图片 fileId + 元数据。
 */
@Data
@Entity
@Table(name = "portal_home_block")
@EntityListeners(AuditingEntityListener.class)
public class PortalHomeBlock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** B 端门户 / C 端独立站 */
    @Column(name = "scope", nullable = false, length = 1)
    private String scope = "B";

    /** hero/services/works/process/craft/haute/about/contact/cta */
    @Column(name = "section", nullable = false, length = 50)
    private String section;

    @Column(name = "block_key", nullable = false, length = 100)
    private String blockKey;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "content_json", columnDefinition = "JSON")
    private String contentJson;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
