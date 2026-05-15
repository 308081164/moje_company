package com.jewelry.system.dto.portal;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class PortalShowcaseReorderRequest {
    @NotEmpty
    private List<Long> itemIdsInOrder;
}
