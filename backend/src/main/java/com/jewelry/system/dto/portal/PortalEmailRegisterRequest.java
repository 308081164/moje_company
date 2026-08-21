package com.jewelry.system.dto.portal;

import lombok.Data;

@Data
public class PortalEmailRegisterRequest {
    private String email;
    private String code;
    private String displayName;
}
