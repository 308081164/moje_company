package com.jewelry.system.dto.b2b;

import lombok.Builder;
import lombok.Data;

/** B 端创建订单页默认填充：账号资料 + 最近一单的需求字段 */
@Data
@Builder
public class B2BLastOrderProfileDto {
    private String companyName;
    private String contactPerson;
    private String styleInfo;
    private String materialInfo;
}
