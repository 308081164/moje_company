package com.jewelry.system.dto.order;

import lombok.Data;

@Data
public class ServiceRequestResolveRequest {
    /** RESOLVED | REJECTED | IN_PROGRESS */
    private String status;
    private String staffNote;
}
