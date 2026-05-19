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
    private Boolean readyForConfirm;
    private List<String> missingFields = new ArrayList<>();
}
