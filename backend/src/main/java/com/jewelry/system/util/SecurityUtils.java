package com.jewelry.system.util;

import com.jewelry.system.security.AccountKind;
import com.jewelry.system.security.SecurityUserPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

public final class SecurityUtils {

    private SecurityUtils() {
    }

    public static Optional<SecurityUserPrincipal> currentPrincipal() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof SecurityUserPrincipal p)) {
            return Optional.empty();
        }
        return Optional.of(p);
    }

    /**
     * JWT subject 数字 ID（员工 / B2B 客户 / C 门户客户，视 {@link SecurityUserPrincipal#getAccountKind()} 而定）。
     */
    public static Optional<Long> currentUserId() {
        return currentPrincipal().map(SecurityUserPrincipal::getUserId);
    }

    public static Optional<Long> currentB2bClientId() {
        return currentPrincipal()
                .filter(SecurityUserPrincipal::isB2bClient)
                .map(SecurityUserPrincipal::getUserId);
    }

    public static Optional<Long> currentPortalCustomerId() {
        return currentPrincipal()
                .filter(SecurityUserPrincipal::isPortalCustomer)
                .map(SecurityUserPrincipal::getUserId);
    }

    public static Optional<Long> currentStaffUserId() {
        return currentPrincipal()
                .filter(SecurityUserPrincipal::isStaff)
                .map(SecurityUserPrincipal::getUserId);
    }

    public static Optional<AccountKind> currentAccountKind() {
        return currentPrincipal().map(SecurityUserPrincipal::getAccountKind);
    }

    public static Optional<String> currentRoleApi() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof SecurityUserPrincipal p)) {
            return Optional.empty();
        }
        return Optional.ofNullable(p.getRoleApi());
    }
}
