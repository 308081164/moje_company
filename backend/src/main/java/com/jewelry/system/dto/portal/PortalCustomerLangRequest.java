package com.jewelry.system.dto.portal;

import lombok.Data;

@Data
public class PortalCustomerLangRequest {
    /** 语言偏好，如 en / zh-CN / fr / de / es / ja / ko / zh-TW */
    private String lang;
}
