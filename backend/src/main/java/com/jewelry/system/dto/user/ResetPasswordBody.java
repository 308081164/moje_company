package com.jewelry.system.dto.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ResetPasswordBody {

    @NotNull
    private Long userId;

    @NotBlank
    @Size(min = 6, max = 100)
    private String newPassword;

    private String confirmPassword;
}
