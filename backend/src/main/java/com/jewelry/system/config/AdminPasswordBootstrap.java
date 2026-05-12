package com.jewelry.system.config;

import com.jewelry.system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * 将 Flyway 种子中占位 BCrypt 替换为可登录密码（与 app.default-admin.password 一致）。
 */
@Component
@RequiredArgsConstructor
public class AdminPasswordBootstrap {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.default-admin.username}")
    private String adminUsername;

    @Value("${app.default-admin.password}")
    private String defaultPassword;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureAdminPassword() {
        if (!StringUtils.hasText(defaultPassword)) {
            return;
        }
        userRepository.findByUsername(adminUsername).ifPresent(u -> {
            String p = u.getPassword();
            if (p == null || p.length() < 50 || p.contains("YourHashedPasswordHere")) {
                u.setPassword(passwordEncoder.encode(defaultPassword));
                userRepository.save(u);
            }
        });
    }
}
