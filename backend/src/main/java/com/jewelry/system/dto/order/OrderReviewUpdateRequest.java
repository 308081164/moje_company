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
    /** DESIGN=设计质量评审；MODEL=建模工艺评审（默认） */
    private String reviewKind;
    /** 按件评审的单件 ID；多件订单必填，单件订单可省略（默认第一件） */
    private Long pieceId;
}
