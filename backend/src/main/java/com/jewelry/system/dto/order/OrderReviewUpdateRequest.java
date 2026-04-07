package com.jewelry.system.dto.order;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OrderReviewUpdateRequest {
    private Long trackerId;
    private String reviewNotes;
    private List<String> rejectedProcesses;
    private String rejectionReason;
}
