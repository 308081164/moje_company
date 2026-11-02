package com.jewelry.system.dto.portal;

import lombok.Data;

@Data
public class PortalBalancePayRequest {
    /** 支付尾款时是否勾选自动上架小店（履约完成后执行） */
    private Boolean autoPublishToStorefront;
}
