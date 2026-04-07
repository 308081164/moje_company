package com.jewelry.system.dto.order;

import lombok.Data;

/**
 * 与前端 ProcessInfo 对齐（工艺库配置使用 OTHER + customProcess 表示中文名称）。
 */
@Data
public class ProcessConfigItemDto {

    private Long id;
    private String processType = "OTHER";
    private String customProcess;
    private double additionalCost;
    private String notes;
}
