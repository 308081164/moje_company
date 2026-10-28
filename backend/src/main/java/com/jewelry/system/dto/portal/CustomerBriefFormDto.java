package com.jewelry.system.dto.portal;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class CustomerBriefFormDto {
    private Long orderId;
    private String orderNumber;
    private String metalCode;
    private String metalLabel;
    private Boolean inlayAllowed;
    private String budgetBand;
    private Boolean submitted;
    private List<CustomerBriefSubmitRequest.Piece> pieces;
    private List<PieceName> pieceNames;

    @Data
    @Builder
    public static class PieceName {
        private Long pieceId;
        private Integer seq;
        private String name;
    }
}
