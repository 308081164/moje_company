package com.moje.jewelry3d.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/**
 * 任务视图 DTO（前端 snake_case 兼容）
 */
@Data
public class TaskViewDto {

    @JsonProperty("task_id")
    private String taskId;

    @JsonProperty("input_file")
    private String inputFile;

    private String status;

    private Double progress;

    private String prompt;

    @JsonProperty("output_format")
    private String outputFormat;

    @JsonProperty("inlay_file")
    private String inlayFile;

    @JsonProperty("result_file")
    private String resultFile;

    @JsonProperty("error_message")
    private String errorMessage;

    @JsonProperty("created_at")
    private String createdAt;

    @JsonProperty("updated_at")
    private String updatedAt;
}
