package com.jewelry.system.dto.order;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OrderDesignUpdateRequest {
    private String engravingText;
    private String materialType;
    private String materialDetail;
    private String handSize;
    private Long designerId;
    private Object processInfo;
    private Object stoneInfo;
    private String designNotes;
    private List<String> designImages;
}
