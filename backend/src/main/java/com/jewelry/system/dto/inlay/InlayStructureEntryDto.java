package com.jewelry.system.dto.inlay;

import lombok.Data;

@Data
public class InlayStructureEntryDto {
    /** 相对库根的路径，目录以 / 结尾 */
    private String path;
    private String name;
    private boolean directory;
    private Long size;
    private String lastModified;
    private String url;
}
