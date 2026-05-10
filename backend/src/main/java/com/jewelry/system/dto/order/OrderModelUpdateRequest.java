package com.jewelry.system.dto.order;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OrderModelUpdateRequest {
    private Double weight;
    private Long modelerId;
    private String modelNotes;
    /** 效果图 URL 列表（与设计师 designImages 存法一致） */
    private List<String> modelEffectImageUrls;
    /** 源文件：本订单下已上传文件的 ID（通常为 MODEL 类型） */
    private List<Long> modelSourceFileIds;
}
