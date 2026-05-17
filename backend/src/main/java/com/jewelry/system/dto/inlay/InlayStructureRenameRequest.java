package com.jewelry.system.dto.inlay;

import lombok.Data;

@Data
public class InlayStructureRenameRequest {
    private String path;
    private String newName;
}
