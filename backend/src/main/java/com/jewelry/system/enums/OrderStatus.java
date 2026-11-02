package com.jewelry.system.enums;

public enum OrderStatus {
    PENDING_DESIGN("设计中"),
    DESIGNING("设计复审中"),
    /** 设计稿已交跟单，待工艺/质量评审；通过后系统发给客户审阅 */
    PENDING_DESIGN_REVIEW("待设计评审"),
    PENDING_MODEL("建模中"),
    MODELING("建模修改中"),
    PENDING_REVIEW("待建模评审"),
    PENDING_PRODUCTION("待发送生产"),
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
                return targetStatus == DESIGNING || targetStatus == PENDING_DESIGN_REVIEW || targetStatus == CANCELLED;
            case DESIGNING:
                return targetStatus == PENDING_DESIGN_REVIEW || targetStatus == PENDING_MODEL || targetStatus == CANCELLED;
            case PENDING_DESIGN_REVIEW:
                return targetStatus == DESIGNING || targetStatus == PENDING_MODEL || targetStatus == CANCELLED;
            case PENDING_MODEL:
                return targetStatus == MODELING || targetStatus == PENDING_REVIEW || targetStatus == DESIGNING
                        || targetStatus == CANCELLED;
            case MODELING:
                return targetStatus == PENDING_REVIEW || targetStatus == DESIGNING || targetStatus == CANCELLED;
            case PENDING_REVIEW:
                return targetStatus == PENDING_PRODUCTION || targetStatus == PRODUCING || targetStatus == MODELING
                        || targetStatus == CANCELLED;
            case PENDING_PRODUCTION:
                // 客户驳回建模稿后可退回建模修改，重新走跟单→客户循环
                return targetStatus == PRODUCING || targetStatus == MODELING || targetStatus == CANCELLED;
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
                return PENDING_DESIGN_REVIEW;
            case PENDING_DESIGN_REVIEW:
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