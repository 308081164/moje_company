package com.jewelry.system.util;

import com.jewelry.system.security.SecurityUserPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

public final class SecurityUtils {

    private SecurityUtils() {
    }

    public static Optional<Long> currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof SecurityUserPrincipal p)) {
            return Optional.empty();
        }
        return Optional.of(p.getUserId());
    }

    public static Optional<String> currentRoleApi() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof SecurityUserPrincipal p)) {
            return Optional.empty();
        }
        return Optional.ofNullable(p.getRoleApi());
    }
}
