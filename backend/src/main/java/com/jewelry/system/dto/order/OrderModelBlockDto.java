package com.jewelry.system.dto.order;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class OrderModelBlockDto {
    private Long id;
    private Long orderId;
    private Long modelerId;
    private String modelerName;
    private Double weight;
    private Object modelFiles;
    private List<String> modelEffectImages;
    private String modelNotes;
    private Boolean modelPassed;
    private String modelPassedTime;
    private String createdAt;
    private String updatedAt;
    /** 建模师最近一次驳回给设计师的说明（供设计师/订单详情展示） */
    private String lastRejectToDesignerMessage;
    private List<Long> lastRejectToDesignerAttachmentFileIds;
}
