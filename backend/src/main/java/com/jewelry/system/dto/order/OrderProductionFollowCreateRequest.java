package com.jewelry.system.dto.order;

import lombok.Data;

import java.util.List;

@Data
public class OrderProductionFollowCreateRequest {
    /** 工序说明，可与图片二选一或同时填写 */
    private String note;
    private List<Long> imageFileIds;
}
