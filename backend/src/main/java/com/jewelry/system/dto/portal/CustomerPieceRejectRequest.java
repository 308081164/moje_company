package com.jewelry.system.dto.portal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class CustomerPieceRejectRequest {
    private String eventType;
    private String reason;
}
