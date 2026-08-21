package com.jewelry.system.dto.portal;

import lombok.Data;

@Data
public class PortalEmailCodeRequest {
    private String email;
    /** LOGIN / REGISTER / BIND，默认 LOGIN */
    private String purpose;
}
