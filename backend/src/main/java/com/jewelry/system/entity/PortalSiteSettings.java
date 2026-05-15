package com.jewelry.system.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "portal_site_settings")
public class PortalSiteSettings {

    public static final long SINGLETON_ID = 1L;

    @Id
    @Column(name = "id")
    private Long id = SINGLETON_ID;

    @Column(name = "hero_title", length = 200)
    private String heroTitle;

    @Column(name = "hero_subtitle", length = 500)
    private String heroSubtitle;

    @Column(name = "about_html", columnDefinition = "MEDIUMTEXT")
    private String aboutHtml;

    @Column(name = "business_hours", length = 500)
    private String businessHours;

    @Column(name = "contact_phone", length = 100)
    private String contactPhone;

    @Column(name = "contact_wechat", length = 200)
    private String contactWechat;

    @Column(name = "contact_email", length = 200)
    private String contactEmail;

    @Column(name = "address", length = 500)
    private String address;

    @Column(name = "carousel_file_ids", columnDefinition = "TEXT")
    private String carouselFileIdsJson;

    @Column(name = "company_photo_file_ids", columnDefinition = "TEXT")
    private String companyPhotoFileIdsJson;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
