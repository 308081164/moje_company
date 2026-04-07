package com.jewelry.system.dto.user;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class UserResponse {

    private Long id;
    private String username;
    private String realName;
    private String email;
    private String phone;
    private String role;
    private String roleDescription;
    private String status;
    private List<String> permissions;
    private String createdAt;
    private String updatedAt;
}
