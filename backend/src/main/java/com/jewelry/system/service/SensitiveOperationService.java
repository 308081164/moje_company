package com.jewelry.system.service;

import com.jewelry.system.entity.User;
import com.jewelry.system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/**
 * 敏感操作二级密码：与「取消订单」等业务共用，校验默认管理员账号的登录密码。
 */
@Service
@RequiredArgsConstructor
public class SensitiveOperationService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.default-admin.username}")
    private String adminUsername;

    public void verifySecondaryPassword(String rawPassword) {
        if (!StringUtils.hasText(rawPassword)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请输入二级密码");
        }
        User admin = userRepository.findByUsername(adminUsername)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "未配置管理员账号"));
        if (!passwordEncoder.matches(rawPassword.trim(), admin.getPassword())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "二级密码错误");
        }
    }
}
