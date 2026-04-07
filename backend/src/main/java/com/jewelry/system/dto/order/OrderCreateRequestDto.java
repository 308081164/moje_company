package com.jewelry.system.dto.order;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class OrderCreateRequestDto {

    @NotBlank
    private String source;
    private String sourceDetail;
    @NotNull
    private BigDecimal depositAmount;
    @NotBlank
    private String basicRequirements;
    @NotBlank
    private String orderTime;
    private String style;
    private String materialInfo;
    @NotBlank
    private String customerContact;
    private String customerName;
    private String customerWechat;
}
