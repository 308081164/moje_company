package com.jewelry.system.dto.conversation;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OrderAiIntakeCollectedDto {
    private String stylePreference;
    private String materialPreference;
    private String occasion;
    private String engraving;
    private String budgetOrTimeline;
    private String sizeNotes;
    private List<PieceSizeNote> pieces;
    private String otherNotes;
    private String summary;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PieceSizeNote {
        private String pieceName;
        private String jewelryType;
        private String size;
    }
}
