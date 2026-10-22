package com.jewelry.system.dto.order;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "发货请求（跟单员录入快递单号）")
public class ShipOrderRequest {

    @Schema(description = "快递单号", required = true, example = "RR123456789CN")
    private String trackingNumber;

    @Schema(description = "17TRACK 承运商编码，可空（空则自动识别）", example = "100003")
    private Integer carrierCode;

    @Schema(description = "承运商名称，可空（如 DHL、FedEx）", example = "DHL")
    private String carrierName;
}
