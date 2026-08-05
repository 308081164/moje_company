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

    /** fast=快速模式 quality=高精度模式 ultra=Ultra CAD 模式 */
    @JsonProperty("generation_mode")
    private String generationMode;

    /** Ultra 模式 STEP 下载 URL（任务完成且拟合成功时） */
    @JsonProperty("cad_step_url")
    private String cadStepUrl;

    /** Ultra CAD 拟合评分 0–100 */
    @JsonProperty("cad_fit_score")
    private Integer cadFitScore;

    @JsonProperty("inlay_file")
    private String inlayFile;

    @JsonProperty("result_file")
    private String resultFile;

    @JsonProperty("preview_url")
    private String previewUrl;

    @JsonProperty("input_preview_url")
    private String inputPreviewUrl;

    @JsonProperty("error_message")
    private String errorMessage;

    @JsonProperty("created_at")
    private String createdAt;

    @JsonProperty("updated_at")
    private String updatedAt;
}
