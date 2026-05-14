package com.jewelry.system.dto.admin;

import lombok.Data;

@Data
public class OrderBulkZipRequest {
    /** ALL | B2B | C2C */
    private String segment = "ALL";
    private String startDate;
    private String endDate;
}
