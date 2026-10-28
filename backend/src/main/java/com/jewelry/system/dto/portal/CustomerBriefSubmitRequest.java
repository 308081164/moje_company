package com.jewelry.system.dto.portal;

import lombok.Data;

import java.util.List;

@Data
public class CustomerBriefSubmitRequest {

    private String budgetBand;
    private List<Piece> pieces;

    @Data
    public static class Piece {
        private Long pieceId;
        private String jewelryType;
        private String ringUnit;
        private String ringSize;
        private Boolean withChain;
        private String chainStyle;
        private String braceletMeasure;
        private String braceletValue;
        private String hairKind;
        private String plating;
        private String inlay;
        private String stoneCategory;
        private String stoneColor;
        private String enamel;
    }
}
