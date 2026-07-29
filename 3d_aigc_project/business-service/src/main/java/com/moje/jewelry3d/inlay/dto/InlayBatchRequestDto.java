package com.moje.jewelry3d.inlay.dto;

import lombok.Data;

import java.util.List;

@Data
public class InlayBatchRequestDto {
    private List<String> ids;
    private String categoryId;
    private List<String> addTags;
    private String status;
}
