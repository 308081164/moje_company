package com.moje.jewelry3d.model.dto;

import lombok.Data;

/**
 * 3D生成请求DTO
 * 用于接收前端的生成任务请求参数
 */
@Data
public class GenerateRequest {

    /** 任务类型：image-to-3d（图片转3D）或 condition-generate（条件生成） */
    private String taskType;

    /** 镶嵌底座文件名（条件生成时使用，可选） */
    private String inlayStructureFilename;

    /** 生成参数（JSON格式，可选） */
    private String params;
}
