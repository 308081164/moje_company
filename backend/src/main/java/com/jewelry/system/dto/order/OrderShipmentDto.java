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
    /** 17TRACK 官方查询链接，作为云途轨迹之外的补充入口 */
    private String queryUrl;
    /** 当前运单是否走云途沙盒。沙盒轨迹只展示接口真实返回的节点。 */
    private Boolean sandbox;
    /** 给客户和跟单员看的物流说明，例如沙盒暂无节点 */
    private String trackingNote;
    /** 末端派送商名称 */
    private String lastMileName;
    /** 末端跟踪号 */
    private String lastMileTracking;
    /** 末端查询网址 */
    private String lastMileSite;
    /** 末端联系电话 */
    private String lastMilePhone;
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
