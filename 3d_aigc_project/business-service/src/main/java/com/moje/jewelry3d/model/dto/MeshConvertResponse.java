package com.moje.jewelry3d.model.dto;

import lombok.Data;

/**
 * 网格格式转换响应
 */
@Data
public class MeshConvertResponse {
    private String sessionId;
    private String sourceFormat;
    private String outputFormat;
    private String originalFilename;
    private long fileSize;
    private int vertexCount;
    private int faceCount;
    /** 下载地址（相对 /api） */
    private String downloadUrl;
    /** 预览地址（相对 /api，inline） */
    private String previewUrl;
}
