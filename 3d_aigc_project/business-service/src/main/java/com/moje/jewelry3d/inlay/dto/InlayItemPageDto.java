package com.moje.jewelry3d.inlay.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class InlayItemPageDto {
    private List<InlayItemDto> items;
    private long total;
    private int page;

    @JsonProperty("page_size")
    private int pageSize;

    private Map<String, Long> stats;
}
