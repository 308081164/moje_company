package com.jewelry.system.dto.order;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class OrderShipmentDto {

    private Long id;
    private Long orderId;
    private String trackingNumber;
    private Integer carrierCode;
    private String carrierName;
    /** 原始状态码 */
    private String status;
    /** 状态中文标签 */
    private String statusLabel;
    /** 物流轨迹事件 */
    private List<Event> events;
    /** 17TRACK 官方查询链接 */
    private String queryUrl;
    private String shippedAt;
    private String deliveredAt;

    @Data
    @Builder
    public static class Event {
        private String time;
        private String location;
        private String description;
        private String statusCode;
    }
}
