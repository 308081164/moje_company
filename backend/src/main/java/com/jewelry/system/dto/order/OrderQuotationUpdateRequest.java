package com.jewelry.system.dto.order;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OrderQuotationUpdateRequest {
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
}
