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

    private final Long userId;
    private final String username;
    private final String roleApi;
    private final Collection<? extends GrantedAuthority> authorities;

    public SecurityUserPrincipal(Long userId, String username, String roleApi) {
        this.userId = userId;
        this.username = username;
        this.roleApi = roleApi;
        this.authorities = List.of(new SimpleGrantedAuthority("ROLE_" + roleApi));
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
