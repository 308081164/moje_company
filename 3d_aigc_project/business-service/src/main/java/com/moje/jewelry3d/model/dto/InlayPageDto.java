package com.moje.jewelry3d.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

/**
 * 镶嵌结构分页列表
 */
@Data
public class InlayPageDto {

    private List<InlayViewDto> items;

    private long total;

    private int page;

    @JsonProperty("page_size")
    private int pageSize;

    /** 当前筛选条件下各格式数量统计 */
    @JsonProperty("format_counts")
    private java.util.Map<String, Long> formatCounts;
}
