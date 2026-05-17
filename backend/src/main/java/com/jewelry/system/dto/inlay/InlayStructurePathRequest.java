package com.jewelry.system.dto.inlay;

import lombok.Data;

@Data
public class InlayStructurePathRequest {
    /** 父目录相对路径，空或 / 表示根 */
    private String parentPath;
    private String name;
}
