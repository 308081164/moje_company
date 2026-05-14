package com.jewelry.system.dto.portal;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class PortalCustomerLoginResponse {
    private Long id;
    private String contact;
    private String displayName;
    private String accessToken;
    private long expiresIn;
    private LocalDateTime createdAt;
}
