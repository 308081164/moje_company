package com.jewelry.system.dto.portal;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class PortalHomePublicDto {
    private String heroTitle;
    private String heroSubtitle;
    private String aboutHtml;
    private String businessHours;
    private String contactPhone;
    private String contactWechat;
    private String contactEmail;
    private String address;
    private List<PortalImageDto> carousel;
    private List<PortalImageDto> companyPhotos;
    private List<PortalCategoryPublicDto> categories;
}
