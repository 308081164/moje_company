package com.jewelry.system.service;

import com.jewelry.system.dto.LoginRequest;
import com.jewelry.system.dto.LoginResponse;
import com.jewelry.system.enums.UserRole;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class AuthServiceImpl implements AuthService {

    private static final long DEFAULT_EXPIRES_IN_SECONDS = 86400L;

    @Override
    public LoginResponse login(LoginRequest loginRequest) {
        // 先提供最小可编译实现，后续接入真实用户校验/JWT 逻辑
        String accessToken = UUID.randomUUID().toString();
        String refreshToken = UUID.randomUUID().toString();

        LoginResponse response = new LoginResponse();
        response.setAccessToken(accessToken);
        response.setRefreshToken(refreshToken);
        response.setExpiresIn(DEFAULT_EXPIRES_IN_SECONDS);
        response.setLoginTime(LocalDateTime.now());

        response.setUserId(0L);
        response.setUsername(loginRequest != null ? loginRequest.getUsername() : null);
        response.setRealName(null);
        response.setRole(UserRole.ADMIN);
        response.setRoleDescription("管理员");
        response.setPermissions(new String[0]);

        return response;
    }

    @Override
    public void logout(String token) {
        // no-op
    }

    @Override
    public LoginResponse refreshToken(String refreshToken) {
        LoginResponse response = new LoginResponse();
        response.setAccessToken(UUID.randomUUID().toString());
        response.setRefreshToken(refreshToken);
        response.setExpiresIn(DEFAULT_EXPIRES_IN_SECONDS);
        response.setLoginTime(LocalDateTime.now());
        response.setUserId(0L);
        response.setUsername(null);
        response.setRole(UserRole.ADMIN);
        response.setRoleDescription("管理员");
        response.setPermissions(new String[0]);
        return response;
    }

    @Override
    public Object getCurrentUser() {
        Map<String, Object> user = new LinkedHashMap<>();
        user.put("userId", 0L);
        user.put("username", "system");
        user.put("role", UserRole.ADMIN);
        return user;
    }
}

