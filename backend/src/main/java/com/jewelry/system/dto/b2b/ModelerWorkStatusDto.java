package com.jewelry.system.dto.b2b;

import lombok.Data;

@Data
public class ModelerWorkStatusDto {
    private Long userId;
    private String username;
    private String realName;
    private String workMode;
    private String status;
    private Integer todoCount;
    private String pauseReason;
}