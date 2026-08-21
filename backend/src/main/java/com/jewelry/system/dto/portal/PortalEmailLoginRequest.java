package com.jewelry.system.dto.portal;

import lombok.Data;

@Data
public class PortalEmailLoginRequest {
    private String email;
    private String code;
}
