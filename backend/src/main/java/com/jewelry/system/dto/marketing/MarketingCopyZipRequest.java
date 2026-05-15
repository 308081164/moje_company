package com.jewelry.system.dto.marketing;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class MarketingCopyZipRequest {
    @NotEmpty
    @Size(max = 100)
    private List<Long> orderIds;
}
