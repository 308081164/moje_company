package com.jewelry.system.dto.order;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class OrderDesignBlockDto {
    private Long id;
    private Long orderId;
    private Long pieceId;
    private Long designerId;
    private String designerName;
    private String engravingText;
    private List<String> engravingImages;
    private String materialType;
    private String materialDetail;
    private String handSize;
    private String plating;
    private Object processInfo;
    private Object stoneInfo;
    private String designNotes;
    private List<String> designImages;
    private Boolean designPassed;
    private String designPassedTime;
    private String createdAt;
    private String updatedAt;
    /** 客户最近一次驳回设计稿的原因（驳回后、设计师再次提交前有效） */
    private String lastCustomerDesignRejectReason;
    private String lastCustomerDesignRejectTime;
}
