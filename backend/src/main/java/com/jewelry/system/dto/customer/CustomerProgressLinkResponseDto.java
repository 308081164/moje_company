package com.jewelry.system.dto.customer;

import lombok.Builder;
import lombok.Data;

/**
 * 设计师生成/刷新链接后的响应（前端用于拼二维码、下载名片图）。
 */
@Data
@Builder
public class CustomerProgressLinkResponseDto {
    private String token;
    /** 客户在手机浏览器打开的完整前端地址 */
    private String publicPageUrl;
    private String expiresAt;
}
