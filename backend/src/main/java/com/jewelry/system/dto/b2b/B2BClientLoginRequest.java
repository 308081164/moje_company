package com.jewelry.system.dto.b2b;

import lombok.Data;

@Data
public class B2BClientLoginRequest {
    private String contact;
    private String password;
}