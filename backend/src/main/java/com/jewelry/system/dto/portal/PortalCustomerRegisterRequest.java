package com.jewelry.system.dto.portal;

import lombok.Data;

@Data
public class PortalCustomerRegisterRequest {
    /** 手机号或微信，必填 */
    private String contact;
    private String password;
    private String displayName;
    /** 若从定制链接进入，提交后自动绑定订单 */
    private String viewToken;
}
