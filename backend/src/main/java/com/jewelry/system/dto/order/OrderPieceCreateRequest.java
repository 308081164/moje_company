package com.jewelry.system.dto.order;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OrderPieceCreateRequest {
    private String name;
    /** RING / NECKLACE / EARRING / BROOCH / BRACELET / OTHER */
    private String jewelryType;
}
