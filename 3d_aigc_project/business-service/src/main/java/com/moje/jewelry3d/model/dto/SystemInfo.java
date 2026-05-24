package com.moje.jewelry3d.model.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * 系统信息DTO
 * 包含AI服务的系统状态信息（GPU、内存等）
 */
@Data
public class SystemInfo {

    /** 服务名称 */
    private String serviceName;

    /** 服务版本 */
    private String version;

    /** 服务状态 */
    private String status;

    /** GPU信息列表 */
    private List<Map<String, Object>> gpuInfo;

    /** 可用内存（MB） */
    private Long availableMemoryMb;

    /** 已使用内存（MB） */
    private Long usedMemoryMb;

    /** AI服务是否可用 */
    private boolean aiServiceAvailable;

    /** 额外信息 */
    private Map<String, Object> extra;
}
