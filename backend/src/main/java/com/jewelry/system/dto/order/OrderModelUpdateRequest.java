package com.jewelry.system.dto.order;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OrderModelUpdateRequest {
    private Double weight;
    private Long modelerId;
    private String modelNotes;
}
