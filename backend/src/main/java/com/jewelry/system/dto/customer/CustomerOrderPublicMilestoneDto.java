package com.jewelry.system.dto.customer;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomerOrderPublicMilestoneDto {
    private String code;
    private String label;
    /** ISO-8601 local date-time */
    private String at;
}
