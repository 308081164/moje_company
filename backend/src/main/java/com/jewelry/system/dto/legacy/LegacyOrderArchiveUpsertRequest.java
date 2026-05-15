package com.jewelry.system.dto.legacy;

import com.jewelry.system.enums.LegacyOrderSegment;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class LegacyOrderArchiveUpsertRequest {
    @NotNull
    private LegacyOrderSegment segment;
    private String customerName;
    private String customerPhone;
    private String customerWechat;
    private String orderDate;
    private String completedDate;
    private String styleSummary;
    private String materialSummary;
    private String requirements;
    private String designNotes;
    private String modelingNotes;
    private String quotationNotes;
    private String attachmentsJson;
    private String internalRemark;
}
