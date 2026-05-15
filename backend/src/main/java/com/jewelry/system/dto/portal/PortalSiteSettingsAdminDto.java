package com.jewelry.system.dto.portal;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class PortalSiteSettingsAdminDto {
    private String heroTitle;
    private String heroSubtitle;
    private String aboutHtml;
    private String businessHours;
    private String contactPhone;
    private String contactWechat;
    private String contactEmail;
    private String address;
    private List<Long> carouselFileIds;
    private List<Long> companyPhotoFileIds;
}
