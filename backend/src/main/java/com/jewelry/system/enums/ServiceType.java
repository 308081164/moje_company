package com.jewelry.system.enums;

/**
 * 订单服务类型，区分 C 端来图定制、设计师设计、B 端建模订单三条业务流程。
 */
public enum ServiceType {
    CUSTOM_IMAGE("来图定制"),
    DESIGNER_DESIGN("设计师设计"),
    B2B_MODEL("B端建模订单"),
    STOREFRONT("独立站寄售复产");

    private final String description;

    ServiceType(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }

    public static ServiceType fromString(String value) {
        if (value == null) {
            return null;
        }
        for (ServiceType type : ServiceType.values()) {
            if (type.name().equalsIgnoreCase(value)) {
                return type;
            }
        }
        throw new IllegalArgumentException("未知的服务类型: " + value);
    }
}
