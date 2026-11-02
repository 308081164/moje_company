package com.jewelry.system.dto.order;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class OrderPieceDto {

    private Long id;
    private Long orderId;
    private Integer seq;
    private String name;
    private String jewelryType;
    private Boolean designConfirmed;
    private Boolean modelConfirmed;
    /** 跟单设计质量评审是否已通过 */
    private Boolean designQualityPassed;
    /** 跟单建模质量评审是否已通过 */
    private Boolean modelQualityPassed;
    /** 该单件已有喷蜡跟单记录，工艺验证通过 */
    private Boolean processVerified;
    private List<String> referenceImages;
    /** 客户问卷：是否需要刻字（未提交问卷时为 null） */
    private Boolean customerWantsEngraving;
    private OrderDesignBlockDto design;
    private OrderModelBlockDto model;
}
