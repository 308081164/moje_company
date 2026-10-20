package com.jewelry.system.dto.customer;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class CustomerOrderPublicPieceDto {
    private Long id;
    private Integer seq;
    private String name;
    private Boolean designConfirmed;
    private Boolean modelConfirmed;
    private List<String> referenceImages;
    private List<String> designImages;
    private List<String> modelEffectImages;
}
