package com.jewelry.system.dto.referral;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class ReferralCodeDto {
    private String code;
    /** 带 ref 参数的 C 端首页分享链接 */
    private String shareUrl;
    /** 指向 shareUrl 的二维码（data:image/png;base64,...） */
    private String qrCodeBase64;
    /** 统一佣金比例（0.05 = 5%） */
    private BigDecimal commissionRate;
}
