package com.moje.jewelry3d.model.entity;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 生成任务实体
 * 记录3D生成任务的完整生命周期信息
 */
@Data
public class GenerateTask {

    /** 任务ID（UUID） */
    private String taskId;

    /** 任务类型：image-to-3d / condition-generate */
    private String taskType;

    /** 任务状态：pending / processing / completed / failed */
    private String status;

    /** 上传的设计图文件名 */
    private String inputImageFilename;

    /** 上传的设计图文件路径 */
    private String inputImagePath;

    /** 选择的镶嵌底座文件名（条件生成时使用） */
    private String inlayStructureFilename;

    /** 生成结果文件路径 */
    private String outputPath;

    /** 生成结果文件名 */
    private String outputFilename;

    /** 预览图路径 */
    private String previewPath;

    /** 错误信息（任务失败时） */
    private String errorMessage;

    /** 创建时间 */
    private LocalDateTime createdAt;

    /** 更新时间 */
    private LocalDateTime updatedAt;

    /** 完成时间 */
    private LocalDateTime completedAt;

    /** 额外参数（JSON格式） */
    private String params;
}
