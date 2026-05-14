package com.jewelry.system.dto.admin;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class ModelingArchivesZipRequest {
    @NotEmpty(message = "orderIds 不能为空")
    private List<Long> orderIds;
}
