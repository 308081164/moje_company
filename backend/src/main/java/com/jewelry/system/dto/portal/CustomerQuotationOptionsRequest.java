package com.jewelry.system.dto.portal;

import lombok.Data;

/**
 * 建模全部确认后，客户选择是否买断设计、鉴定证书、保密不宣传，用于生成最终报价与尾款。
 */
@Data
public class CustomerQuotationOptionsRequest {
    private Boolean designBuyout;
    private Boolean appraisalCertificate;
    private Boolean confidential;
}
