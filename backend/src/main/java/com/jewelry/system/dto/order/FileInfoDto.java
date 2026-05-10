package com.jewelry.system.dto.order;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FileInfoDto {
    private Long id;
    private String fileName;
    private String filePath;
    /** 可直接用于预览/下载的访问地址（如 OSS URL） */
    private String fileUrl;
    private String fileType;
    private Long fileSize;
    private Long uploaderId;
    private String uploaderName;
    private String uploadTime;
    private Integer version;
    private Boolean isLatest;
    private String notes;
}
