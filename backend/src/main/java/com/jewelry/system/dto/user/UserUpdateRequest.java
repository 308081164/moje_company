package com.jewelry.system.dto.user;

import lombok.Data;

@Data
public class UserUpdateRequest {

    private String realName;
    private String email;
    private String phone;
    private String role;
    private String status;
}
