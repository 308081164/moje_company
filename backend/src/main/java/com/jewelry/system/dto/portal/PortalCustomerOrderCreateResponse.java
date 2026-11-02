package com.jewelry.system.dto.portal;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PortalCustomerOrderCreateResponse {
    private Long orderId;
    private String orderNumber;
    private Long conversationId;
    private String serviceType;
    /** 前方等待处理的订单数 */
    private Long queueAheadCount;
    /** 是否可支付加急 */
    private Boolean rushEligible;
    private String rushFee;
}
