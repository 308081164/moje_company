package com.jewelry.system.dto.portal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class CustomerPieceConfirmRequest {
    private String eventType;
}
