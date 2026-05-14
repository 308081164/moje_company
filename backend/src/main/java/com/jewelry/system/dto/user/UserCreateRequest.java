package com.jewelry.system.dto.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UserCreateRequest {

    @NotBlank
    @Size(max = 50)
    private String username;

    @NotBlank
    @Size(min = 6, max = 100)
    private String password;

    private String realName;
    private String email;
    private String phone;

    /** 前端角色：PRE_SALES / SALES / TRACKER / ADMIN / DESIGNER / MODELER / DATA_ARCHIVIST */
    @NotBlank
    private String role;

    private String status;
}
