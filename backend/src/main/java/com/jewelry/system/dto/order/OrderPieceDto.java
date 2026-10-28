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
    /** 该单件已有喷蜡跟单记录，工艺验证通过 */
    private Boolean processVerified;
    private List<String> referenceImages;
    private OrderDesignBlockDto design;
    private OrderModelBlockDto model;
}
