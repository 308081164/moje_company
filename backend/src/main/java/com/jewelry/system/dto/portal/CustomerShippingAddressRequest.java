package com.jewelry.system.dto.portal;

import lombok.Data;

@Data
public class CustomerShippingAddressRequest {
    private String recipient;
    private String phone;
    private String country;
    private String address;
    private String postalCode;
}
