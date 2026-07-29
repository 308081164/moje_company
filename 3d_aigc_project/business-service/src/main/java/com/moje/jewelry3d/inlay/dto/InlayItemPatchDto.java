package com.moje.jewelry3d.inlay.dto;

import lombok.Data;

import java.util.List;

@Data
public class InlayItemPatchDto {
    private String displayName;
    private String categoryId;
    private List<String> tags;
    private String inlayType;
    private String status;
    private Float stoneDiameterMm;
}
