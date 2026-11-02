package com.jewelry.system.dto.storefront;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class StorefrontProcessLineDto {
    /** 工艺名称（已本地化展示文案） */
    private String name;
    /** 补充说明 */
    private String notes;
}
