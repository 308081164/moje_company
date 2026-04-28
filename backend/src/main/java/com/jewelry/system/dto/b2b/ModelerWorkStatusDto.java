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
    private Integer c2cTodoCount;
    private Integer b2bTodoCount;
    private Boolean autoAssignEnabled;
    private String pauseReason;
}