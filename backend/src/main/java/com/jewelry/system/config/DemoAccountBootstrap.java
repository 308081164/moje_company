package com.jewelry.system.config;

import com.jewelry.system.entity.User;
import com.jewelry.system.enums.UserRole;
import com.jewelry.system.enums.UserStatus;
import com.jewelry.system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * 创建各角色演示/测试账号（密码统一为 app.demo.password，默认 123456）。
 * 仅当账号不存在时创建，避免覆盖已有账号。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DemoAccountBootstrap {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.demo.password:123456}")
    private String demoPassword;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureDemoAccounts() {
        createIfAbsent("admin", UserRole.ADMIN, "系统管理员");
        createIfAbsent("sales_pre", UserRole.SALES_PRE, "售前客服");
        createIfAbsent("sales_mid", UserRole.SALES_MID, "售中客服");
        createIfAbsent("designer", UserRole.DESIGNER, "设计师");
        createIfAbsent("modeler", UserRole.MODELER, "建模师");
        createIfAbsent("follow_up", UserRole.FOLLOW_UP, "跟单员");
        createIfAbsent("archivist", UserRole.DATA_ARCHIVIST, "数据归档师");
    }

    private void createIfAbsent(String username, UserRole role, String realName) {
        if (userRepository.existsByUsername(username)) {
            return;
        }
        User u = new User();
        u.setUsername(username);
        u.setPassword(passwordEncoder.encode(demoPassword));
        u.setRole(role);
        u.setRealName(realName);
        u.setStatus(UserStatus.ACTIVE);
        userRepository.save(u);
        log.info("已创建演示账号: {} ({})", username, role.getDescription());
    }
}
