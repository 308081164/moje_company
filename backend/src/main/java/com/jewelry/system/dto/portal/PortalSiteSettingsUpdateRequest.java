package com.jewelry.system.dto.portal;

import lombok.Data;

import java.util.List;

@Data
public class PortalSiteSettingsUpdateRequest {
    private String heroTitle;
    private String heroSubtitle;
    private String aboutHtml;
    private String businessHours;
    private String contactPhone;
    private String contactWechat;
    private String contactEmail;
    private String address;
    /** 轮播图文件 ID 顺序 */
    private List<Long> carouselFileIds;
    /** 企业实拍文件 ID 顺序 */
    private List<Long> companyPhotoFileIds;
}
