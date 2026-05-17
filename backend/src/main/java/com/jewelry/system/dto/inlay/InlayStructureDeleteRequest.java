package com.jewelry.system.dto.inlay;

import lombok.Data;

@Data
public class InlayStructureDeleteRequest {
    private String path;
    /** 超出每日免费删除次数时必填，规则与取消订单二级密码一致 */
    private String secondaryPassword;
}
