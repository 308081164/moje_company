package com.jewelry.system.dto.b2b;

import lombok.Data;

@Data
public class B2BClientRegisterRequest {
    private String contact;
    private String password;
    private String companyName;
    private String contactPerson;
    private String email;
}