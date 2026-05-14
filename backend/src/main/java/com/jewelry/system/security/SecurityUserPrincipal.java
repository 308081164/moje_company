package com.jewelry.system.security;

import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

/**
 * JWT 解析后的当前用户（无密码会话）。
 */
@Getter
public class SecurityUserPrincipal implements UserDetails {

    /** 主体数字 ID：员工=users.id，B2B=b2b_clients.id，C 门户=portal_customer_accounts.id */
    private final Long userId;
    private final String username;
    private final String roleApi;
    private final AccountKind accountKind;
    private final Collection<? extends GrantedAuthority> authorities;

    public SecurityUserPrincipal(Long userId, String username, String roleApi, AccountKind accountKind) {
        this.userId = userId;
        this.username = username;
        this.roleApi = roleApi;
        this.accountKind = accountKind != null ? accountKind : AccountKind.STAFF;
        this.authorities = List.of(new SimpleGrantedAuthority("ROLE_" + roleApi));
    }

    public boolean isStaff() {
        return AccountKind.STAFF.equals(accountKind);
    }

    public boolean isB2bClient() {
        return AccountKind.B2B_CLIENT.equals(accountKind);
    }

    public boolean isPortalCustomer() {
        return AccountKind.C_PORTAL_CUSTOMER.equals(accountKind);
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return "";
    }

    @Override
    public String getUsername() {
        return username;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}
