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
    private Boolean designConfirmed;
    private Boolean modelConfirmed;
    private List<String> referenceImages;
    private OrderDesignBlockDto design;
    private OrderModelBlockDto model;
}
