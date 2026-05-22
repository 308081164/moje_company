package com.jewelry.system.dto.b2b.agent;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class B2bAgentDraftDto {
    private String basicRequirements;
    private String styleInfo;
    private String materialInfo;
    private String jewelryType;
    private String companyName;
    private String contactPerson;
    private List<String> referenceImageUrls = new ArrayList<>();
    /** 用户已表示无更多镶嵌/小组件细节图可提供 */
    private Boolean detailImagesComplete;
    private Boolean readyForConfirm;
    private List<String> missingFields = new ArrayList<>();
}
