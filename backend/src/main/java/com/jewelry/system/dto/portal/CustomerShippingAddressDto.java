package com.jewelry.system.dto.portal;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CustomerShippingAddressDto {
    private String recipient;
    private String phone;
    private String country;
    private String address;
    private String postalCode;
    private String submittedAt;
}
