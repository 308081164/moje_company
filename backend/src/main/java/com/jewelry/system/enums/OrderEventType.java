package com.jewelry.system.enums;

/**
 * 订单事件卡片类型，作为订单信息持久化记录的关键节点。
 */
public enum OrderEventType {
    DESIGN_SUBMIT("设计师提交稿"),
    DESIGN_REJECT("客户驳回设计稿"),
    DESIGN_CONFIRM("客户确认设计稿"),
    MODEL_SUBMIT("建模师提交稿"),
    MODEL_REJECT("客户驳回建模稿"),
    MODEL_CONFIRM("客户确认建模稿"),
    REVIEW_PASS("工艺验证通过"),
    REVIEW_REJECT("工艺验证驳回"),
    QUOTATION("报价"),
    PRODUCTION_LOG("生产跟单"),
    STATUS_CHANGE("状态变更"),
    DELIVERY_CONFIRM("客户确认收货"),
    SHIPPED("已发货"),
    DELIVERED("已签收"),
    BALANCE_PAYMENT("支付尾款"),
    BALANCE_PAID("尾款已支付"),
    SHIPPING_ADDRESS_REQUEST("请完善收货信息"),
    SHIPPING_ADDRESS_FILLED("已提交收货信息"),
    DESIGN_OPTIONS_REQUEST("请确认生产选项"),
    DESIGN_OPTIONS_FILLED("已确认生产选项");

    private final String description;

    OrderEventType(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }

    public static OrderEventType fromString(String value) {
        if (value == null) {
            return null;
        }
        for (OrderEventType type : OrderEventType.values()) {
            if (type.name().equalsIgnoreCase(value)) {
                return type;
            }
        }
        throw new IllegalArgumentException("未知的订单事件类型: " + value);
    }
}
