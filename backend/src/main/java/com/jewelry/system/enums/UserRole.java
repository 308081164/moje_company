package com.jewelry.system.enums;

public enum UserRole {
    ADMIN("管理员"),
    SALES_PRE("售前客服"),
    SALES_MID("售中客服"),
    DESIGNER("设计师"),
    MODELER("建模师"),
    FOLLOW_UP("跟单员"),
    DATA_ARCHIVIST("信息化数据归档师");
    
    private final String description;
    
    UserRole(String description) {
        this.description = description;
    }
    
    public String getDescription() {
        return description;
    }
    
    public static UserRole fromString(String role) {
        for (UserRole userRole : UserRole.values()) {
            if (userRole.name().equalsIgnoreCase(role)) {
                return userRole;
            }
        }
        throw new IllegalArgumentException("未知的角色: " + role);
    }
}