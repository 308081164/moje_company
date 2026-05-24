package com.moje.jewelry3d.model.dto;

import lombok.Data;

/**
 * 镶嵌结构信息DTO
 * 描述镶嵌结构数据库中单个文件的基本信息
 */
@Data
public class InlayStructureInfo {

    /** 文件名 */
    private String filename;

    /** 文件格式（扩展名） */
    private String format;

    /** 文件大小（字节） */
    private long fileSize;

    /** 文件大小（可读格式，如 "2.5 MB"） */
    private String fileSizeReadable;

    /** 最后修改时间 */
    private String lastModified;

    /** 文件完整路径 */
    private String filePath;

    /** 是否有预览图 */
    private boolean hasPreview;

    /** 预览图文件名（如果有） */
    private String previewFilename;
}
