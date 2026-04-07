package com.jewelry.system.dto.order;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FileInfoDto {
    private Long id;
    private String fileName;
    private String filePath;
    private String fileType;
    private Long fileSize;
    private Long uploaderId;
    private String uploaderName;
    private String uploadTime;
    private Integer version;
    private Boolean isLatest;
    private String notes;
}
