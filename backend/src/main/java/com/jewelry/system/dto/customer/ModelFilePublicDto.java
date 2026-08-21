package com.jewelry.system.dto.customer;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ModelFilePublicDto {
    private String fileName;
    private String fileUrl;
}
