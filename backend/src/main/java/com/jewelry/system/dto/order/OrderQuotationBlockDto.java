package com.jewelry.system.dto.order;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class OrderQuotationBlockDto {
    private Long id;
    private Long orderId;
    private Double processCost;
    private Double stoneCost;
    private Double materialCost;
    private Double weightCost;
    private Double laborCost;
    private Boolean designBuyout;
    private Boolean copyrightCertificate;
    private Boolean appraisalCertificate;
    private Double designBuyoutCost;
    private Double certificateCost;
    private List<String> certificateTypes;
    private Boolean confidential;
    /** 客户是否已提交生产选项（买断/版权/保密） */
    private Boolean designOptionsFilled;
    private Double otherCost;
    private Double totalCost;
    /** 跟单录入的人民币报价（有换算记录时返回，便于改价回填）。 */
    private Double staffAmountCny;
    private Double fxCnyPerUsd;
    private String quotationNotes;
    private Boolean finalized;
    private String createdAt;
    private String updatedAt;
}
