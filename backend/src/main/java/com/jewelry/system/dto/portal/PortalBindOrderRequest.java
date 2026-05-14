package com.jewelry.system.dto.portal;

import lombok.Data;

@Data
public class PortalBindOrderRequest {
    /** 订单编号，如 B2B202601080001 */
    private String orderNumber;
    /**
     * 凭证：C 端进度 view_token，或 B2B 订单访问 access_token（与链接中路径段一致）。
     */
    private String proofToken;
}
