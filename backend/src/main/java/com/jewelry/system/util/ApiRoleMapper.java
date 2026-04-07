package com.jewelry.system.util;

import com.jewelry.system.enums.UserRole;

/**
 * 前端角色名与数据库枚举映射（前端：PRE_SALES / SALES / TRACKER）。
 */
public final class ApiRoleMapper {

    private ApiRoleMapper() {
    }

    public static String toApiRole(UserRole role) {
        if (role == null) {
            return null;
        }
        return switch (role) {
            case SALES_PRE -> "PRE_SALES";
            case SALES_MID -> "SALES";
            case FOLLOW_UP -> "TRACKER";
            default -> role.name();
        };
    }

    public static UserRole fromApiRole(String apiRole) {
        if (apiRole == null || apiRole.isBlank()) {
            throw new IllegalArgumentException("角色不能为空");
        }
        return switch (apiRole.trim()) {
            case "PRE_SALES" -> UserRole.SALES_PRE;
            case "SALES" -> UserRole.SALES_MID;
            case "TRACKER" -> UserRole.FOLLOW_UP;
            default -> UserRole.valueOf(apiRole.trim());
        };
    }
}
