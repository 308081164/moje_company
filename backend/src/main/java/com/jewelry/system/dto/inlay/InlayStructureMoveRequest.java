package com.jewelry.system.dto.inlay;

import lombok.Data;

@Data
public class InlayStructureMoveRequest {
    private String fromPath;
    /** 目标目录相对路径 */
    private String toDirectoryPath;
}
