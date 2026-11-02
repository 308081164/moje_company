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
        /** YES / NO — 客户问卷：是否需要刻字（字印内容由设计师填写，建模师上传刻字生产文件） */
        private String engraving;
        private String jewelryTypeOther;
        private String chainStyleOther;
        private String platingOther;
        private String hairKindOther;
        private String stoneCategoryOther;
        private String stoneColorOther;
    }
}
