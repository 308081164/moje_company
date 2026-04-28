package com.jewelry.system.dto.b2b;

import lombok.Data;

@Data
public class B2BOrderCreateRequest {
    private String contact;
    private String password;
    private String companyName;
    private String contactPerson;
    private String email;
    
    private String basicRequirements;
    private String styleInfo;
    private String materialInfo;
    private Double depositAmount;
    private String sourceDetail;
}