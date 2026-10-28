package com.jewelry.system.dto.order;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class CustomerBriefViewDto {
    private Boolean submitted;
    private String metalCode;
    private String metalLabel;
    private Boolean inlayAllowed;
    private String budgetBand;
    private String budgetLabel;
    private List<Piece> pieces;

    @Data
    @Builder
    public static class Piece {
        private Long pieceId;
        private String summary;
    }
}
