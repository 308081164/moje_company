package com.jewelry.system.dto.b2b;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ModelerWorkStatusDetailedDto {
    
    private Long userId;
    private String username;
    private String realName;
    private String workMode;
    private String status;
    private Integer totalTodoCount;
    private Integer c2cTodoCount;
    private Integer b2bTodoCount;
    private Boolean autoAssignEnabled;
    private String reasonForPause;
    private List<TaskTimeoutInfoDto timeoutInfo;
    private Boolean isOverloaded;
    
    @Data
    @Builder
    public static class TaskTimeoutInfoDto {
        private Boolean hasTimeoutTasks;
        private Long timeoutWarningHours;
        private Long forceStopHours;
        private Integer timeoutTaskCount;
        private Boolean canContinueAssign;
    }
}
