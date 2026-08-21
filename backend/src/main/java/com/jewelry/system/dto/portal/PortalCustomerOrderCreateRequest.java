package com.jewelry.system.dto.portal;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class PortalCustomerOrderCreateRequest {
    /** CUSTOM_IMAGE / DESIGNER_DESIGN */
    private String serviceType;
    private String customerName;
    private String basicRequirements;
    private String styleInfo;
    private String materialInfo;
    private BigDecimal depositAmount;
    /** 参考图（URL 或 base64 data URI 列表，来图定制必传） */
    private List<String> referenceImages;
}
