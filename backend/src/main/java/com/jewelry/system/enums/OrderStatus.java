package com.jewelry.system.enums;

public enum OrderStatus {
    PENDING_DESIGN("待设计师设计"),
    DESIGNING("设计中"),
    PENDING_MODEL("待建模师设计"),
    MODELING("建模中"),
    PENDING_REVIEW("待工艺验证"),
    PENDING_PRODUCTION("待生产"),
    PRODUCING("生产中"),
    COMPLETED("已完成"),
    CANCELLED("已取消");
    
    private final String description;
    
    OrderStatus(String description) {
        this.description = description;
    }
    
    public String getDescription() {
        return description;
    }
    
    public static OrderStatus fromString(String status) {
        for (OrderStatus orderStatus : OrderStatus.values()) {
            if (orderStatus.name().equalsIgnoreCase(status)) {
                return orderStatus;
            }
        }
        throw new IllegalArgumentException("未知的订单状态: " + status);
    }
    
    // 状态流转检查
    public boolean canTransitionTo(OrderStatus targetStatus) {
        // 已取消的订单不能流转到其他状态
        if (this == CANCELLED) {
            return false;
        }
        
        // 已完成的订单不能流转到其他状态
        if (this == COMPLETED) {
            return false;
        }
        
        // 允许的状态流转
        switch (this) {
            case PENDING_DESIGN:
                return targetStatus == DESIGNING || targetStatus == CANCELLED;
            case DESIGNING:
                return targetStatus == PENDING_MODEL || targetStatus == CANCELLED;
            case PENDING_MODEL:
                return targetStatus == MODELING || targetStatus == DESIGNING || targetStatus == CANCELLED;
            case MODELING:
                return targetStatus == PENDING_REVIEW || targetStatus == DESIGNING || targetStatus == CANCELLED;
            case PENDING_REVIEW:
                return targetStatus == PENDING_PRODUCTION || targetStatus == CANCELLED;
            case PENDING_PRODUCTION:
                return targetStatus == PRODUCING || targetStatus == CANCELLED;
            case PRODUCING:
                return targetStatus == COMPLETED || targetStatus == CANCELLED;
            default:
                return false;
        }
    }
    
    // 获取下一个状态
    public OrderStatus getNextStatus() {
        switch (this) {
            case PENDING_DESIGN:
                return DESIGNING;
            case DESIGNING:
                return PENDING_MODEL;
            case PENDING_MODEL:
                return MODELING;
            case MODELING:
                return PENDING_REVIEW;
            case PENDING_REVIEW:
                return PENDING_PRODUCTION;
            case PENDING_PRODUCTION:
                return PRODUCING;
            case PRODUCING:
                return COMPLETED;
            default:
                return this;
        }
    }
}