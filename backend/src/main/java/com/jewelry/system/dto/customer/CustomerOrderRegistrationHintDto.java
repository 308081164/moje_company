package com.jewelry.system.dto.customer;

import lombok.Builder;
import lombok.Data;

/**
 * 凭进度 view_token 拉取注册/登录表单的预填信息（不增加 view_count）。
 */
@Data
@Builder
public class CustomerOrderRegistrationHintDto {
    private Long orderId;
    private String orderNumber;
    private String displayTitle;
    /** 订单上的手机号，可为空 */
    private String suggestedPhone;
    /** 订单上的微信，可为空 */
    private String suggestedWechat;
    private String suggestedCustomerName;
}
