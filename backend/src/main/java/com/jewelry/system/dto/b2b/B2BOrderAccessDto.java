package com.jewelry.system.dto.b2b;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class B2BOrderAccessDto {
    private Long orderId;
    private String orderNumber;
    private String accessUrl;
    private String token;
    private String qrcodeBase64;
    private LocalDateTime expireTime;
}