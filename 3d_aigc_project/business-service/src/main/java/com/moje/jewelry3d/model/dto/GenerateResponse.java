package com.moje.jewelry3d.model.dto;

import lombok.Data;

/**
 * 3D生成响应DTO
 * 返回生成任务的结果信息
 */
@Data
public class GenerateResponse {

    /** 任务ID */
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
