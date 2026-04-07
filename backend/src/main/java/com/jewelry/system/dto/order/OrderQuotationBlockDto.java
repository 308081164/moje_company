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
    private Double designBuyoutCost;
    private Double certificateCost;
    private List<String> certificateTypes;
    private Boolean confidential;
    private Double otherCost;
    private Double totalCost;
    private String quotationNotes;
    private String createdAt;
    private String updatedAt;
}
