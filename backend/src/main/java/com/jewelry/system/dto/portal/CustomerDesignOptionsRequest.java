package com.jewelry.system.dto.portal;

import lombok.Data;

/** 客户确认全部设计稿后填写：是否买断设计、是否要版权证书、是否保密不宣传。 */
@Data
public class CustomerDesignOptionsRequest {
    private Boolean designBuyout;
    private Boolean copyrightCertificate;
    private Boolean confidential;
}
