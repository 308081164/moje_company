package com.jewelry.system.dto.b2b;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class B2BClientLoginResponse {
    private Long id;
    private String contact;
    private String companyName;
    private String contactPerson;
    private String email;
    private LocalDateTime createdAt;
    private String accessToken;
    private String tokenType = "Bearer";
    private Long expiresIn;
}