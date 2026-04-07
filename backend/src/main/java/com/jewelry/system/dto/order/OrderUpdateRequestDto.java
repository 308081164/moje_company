package com.jewelry.system.dto.order;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class OrderUpdateRequestDto {
    private String source;
    private String sourceDetail;
    private BigDecimal depositAmount;
    private String basicRequirements;
    private String orderTime;
    private String style;
    private String materialInfo;
    private String customerContact;
    private String customerName;
    private String customerWechat;
}
