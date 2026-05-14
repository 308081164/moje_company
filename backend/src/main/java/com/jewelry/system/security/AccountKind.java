package com.jewelry.system.security;

/**
 * JWT 主体类型：避免不同表的数字主键在 subject 上语义冲突。
 */
public enum AccountKind {
    STAFF,
    B2B_CLIENT,
    C_PORTAL_CUSTOMER;

    public static AccountKind fromClaims(String acctClaim, String roleApi) {
        if ("C_PORTAL".equals(acctClaim) || "C_PORTAL_CUSTOMER".equals(roleApi)) {
            return C_PORTAL_CUSTOMER;
        }
        if ("B2B".equals(acctClaim) || "B2B_CLIENT".equals(roleApi)) {
            return B2B_CLIENT;
        }
        return STAFF;
    }
}
