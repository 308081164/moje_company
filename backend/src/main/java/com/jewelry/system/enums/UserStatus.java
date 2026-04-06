package com.jewelry.system.enums;

public enum UserStatus {
    ACTIVE("活跃"),
    INACTIVE("停用"),
    DELETED("已删除");
    
    private final String description;
    
    UserStatus(String description) {
        this.description = description;
    }
    
    public String getDescription() {
        return description;
    }
}