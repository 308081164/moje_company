package com.moje.jewelry3d.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class GenerateResponse {

    @JsonProperty("task_id")
    private String taskId;

    /** 任务状态：pending-等待中, processing-处理中, completed-已完成, failed-失败 */
    private String status;

    /** 状态描述信息 */
    private String message;

    /** 结果文件下载URL（任务完成时返回） */
    private String downloadUrl;

    /** 预览图URL（任务完成时返回） */
    private String previewUrl;
}
