package com.jewelry.system.dto.customer;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * C 端公开订单进度摘要（无敏感联系方式；客户姓名可选脱敏）。
 */
@Data
@Builder
public class CustomerOrderPublicDto {
    private String orderNumber;
    /** 展示用标题：款式 / 需求摘要 / 订单号兜底 */
    private String displayTitle;
    /** 脱敏姓名，可为 null */
    private String customerNameMasked;
    private String createdAt;
    private String currentStatus;
    private String currentStatusLabel;
    private String firstDesignImageUrl;
    private List<CustomerOrderPublicMilestoneDto> milestones;
}
