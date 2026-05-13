package com.jewelry.system.dto.order;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
public class OrderCloseRequestDto {

    @Schema(description = "当日关闭订单已超过 2 单时必填：向杨兴辉索取的二级密钥")
    private String secondaryKey;
}
