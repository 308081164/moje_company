package com.jewelry.system.service;

import com.jewelry.system.dto.LoginRequest;
import com.jewelry.system.dto.LoginResponse;
import com.jewelry.system.dto.user.UserResponse;
import com.jewelry.system.entity.User;
import com.jewelry.system.enums.UserStatus;
import com.jewelry.system.repository.UserRepository;
import com.jewelry.system.security.JwtTokenProvider;
import com.jewelry.system.security.SecurityUserPrincipal;
import com.jewelry.system.util.ApiRoleMapper;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Override
    public LoginResponse login(LoginRequest loginRequest) {
        if (loginRequest == null || loginRequest.getUsername() == null || loginRequest.getPassword() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "用户名与密码不能为空");
        }
        User user = userRepository.findByUsername(loginRequest.getUsername().trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "用户名或密码错误"));
        if (!passwordEncoder.matches(loginRequest.getPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "用户名或密码错误");
        }
        if (!UserStatus.ACTIVE.equals(user.getStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "账号未激活或已禁用");
        }
        return buildLoginResponse(user);
    }

    @Override
    public void logout(String token) {
        // JWT 无服务端会话，客户端丢弃令牌即可
    }

    @Override
    public LoginResponse refreshToken(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "refreshToken 不能为空");
        }
        final Claims claims;
        try {
            claims = jwtTokenProvider.parseRefreshToken(refreshToken);
        } catch (JwtException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "刷新令牌无效或已过期");
        }
        long userId = Long.parseLong(claims.getSubject());
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "用户不存在"));
        if (!UserStatus.ACTIVE.equals(user.getStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "账号未激活或已禁用");
        }
        return buildLoginResponse(user);
    }

    private LoginResponse buildLoginResponse(User user) {
        LoginResponse response = new LoginResponse();
        response.setAccessToken(jwtTokenProvider.createAccessToken(user));
        response.setRefreshToken(jwtTokenProvider.createRefreshToken(user));
        response.setExpiresIn(jwtTokenProvider.getAccessExpirationSeconds());
        response.setLoginTime(LocalDateTime.now());
        response.setUserId(user.getId());
        response.setUsername(user.getUsername());
        response.setRealName(user.getRealName());
        response.setRole(ApiRoleMapper.toApiRole(user.getRole()));
        response.setRoleDescription(user.getRole() != null ? user.getRole().getDescription() : null);
        response.setPermissions(new String[0]);
        return response;
    }

    @Override
    public UserResponse getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof SecurityUserPrincipal p)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录或令牌无效");
        }
        User user = userRepository.findById(p.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "用户不存在"));
        return UserMapper.toResponse(user);
    }
}
