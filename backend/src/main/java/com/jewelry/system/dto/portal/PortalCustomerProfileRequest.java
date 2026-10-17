package com.jewelry.system.dto.portal;

import lombok.Data;

@Data
public class PortalCustomerProfileRequest {
    /** 称呼（displayName） */
    private String displayName;
    /** 联系方式（contact，默认为邮箱，用户可改） */
    private String contact;
}
