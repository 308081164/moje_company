package com.jewelry.system.dto.inlay;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class InlayStructureListDto {
    private String currentPath;
    private List<InlayStructureEntryDto> entries = new ArrayList<>();
}
