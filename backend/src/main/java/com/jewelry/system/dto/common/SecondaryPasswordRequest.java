package com.jewelry.system.dto.common;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SecondaryPasswordRequest {
    @NotBlank
    private String secondaryPassword;
}
