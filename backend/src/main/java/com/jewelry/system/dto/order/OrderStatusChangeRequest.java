package com.jewelry.system.dto.order;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class OrderStatusChangeRequest {
    @NotBlank
    private String status;
    private String notes;
    /** 取消订单等敏感操作时必填，校验规则同镶嵌结构库超额删除 */
    private String secondaryPassword;
}
