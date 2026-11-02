package com.jewelry.system.service;

import com.jewelry.system.dto.user.*;
import com.jewelry.system.entity.User;
import com.jewelry.system.enums.UserRole;
import com.jewelry.system.enums.UserStatus;
import com.jewelry.system.repository.UserRepository;
import com.jewelry.system.util.ApiRoleMapper;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;
    private final AutoAssignmentService autoAssignmentService;

    @Transactional(readOnly = true)
    public Page<UserResponse> list(String username, String realName, String roleApi, String statusStr, Pageable pageable) {
        Specification<User> spec = (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (username != null && !username.isBlank()) {
                ps.add(cb.like(cb.lower(root.get("username")), "%" + username.trim().toLowerCase() + "%"));
            }
            if (realName != null && !realName.isBlank()) {
                ps.add(cb.like(root.get("realName"), "%" + realName.trim() + "%"));
            }
            if (roleApi != null && !roleApi.isBlank()) {
                UserRole ur = ApiRoleMapper.fromApiRole(roleApi.trim());
                ps.add(cb.equal(root.get("role"), ur));
            }
            if (statusStr != null && !statusStr.isBlank()) {
                try {
                    ps.add(cb.equal(root.get("status"), UserStatus.valueOf(statusStr.trim())));
                } catch (IllegalArgumentException ignored) {
                    // 忽略无效状态筛选
                }
            }
            if (ps.isEmpty()) {
                return cb.conjunction();
            }
            return cb.and(ps.toArray(new Predicate[0]));
        };
        return userRepository.findAll(spec, pageable).map(UserMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public UserResponse getById(long id) {
        User u = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在"));
        return UserMapper.toResponse(u);
    }

    @Transactional
    public UserResponse create(UserCreateRequest req) {
        if (userRepository.existsByUsername(req.getUsername().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "用户名已存在");
        }
        User u = new User();
        u.setUsername(req.getUsername().trim());
        u.setPassword(passwordEncoder.encode(req.getPassword()));
        u.setRealName(req.getRealName());
        u.setEmail(req.getEmail());
        u.setPhone(req.getPhone());
        u.setRole(ApiRoleMapper.fromApiRole(req.getRole()));
        u.setStatus(parseStatus(req.getStatus(), UserStatus.ACTIVE));
        userRepository.save(u);
        auditLogService.log("USER_CREATE", "USER", u.getId(), "创建用户: " + u.getUsername());
        return UserMapper.toResponse(u);
    }

    @Transactional
    public UserResponse update(long id, UserUpdateRequest req) {
        User u = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在"));
        boolean wasActiveDesigner = isActiveDesigner(u);
        boolean wasActiveModeler = isActiveModeler(u);
        if (req.getUsername() != null && !req.getUsername().isBlank()) {
            String next = req.getUsername().trim();
            if (!next.equals(u.getUsername()) && userRepository.existsByUsername(next)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "用户名已存在");
            }
            u.setUsername(next);
        }
        if (req.getRealName() != null) {
            u.setRealName(req.getRealName());
        }
        if (req.getEmail() != null) {
            u.setEmail(req.getEmail());
        }
        if (req.getPhone() != null) {
            u.setPhone(req.getPhone());
        }
        if (req.getRole() != null && !req.getRole().isBlank()) {
            u.setRole(ApiRoleMapper.fromApiRole(req.getRole()));
        }
        if (req.getStatus() != null && !req.getStatus().isBlank()) {
            u.setStatus(parseStatus(req.getStatus(), u.getStatus()));
        }
        userRepository.save(u);
        if (wasActiveDesigner && !isActiveDesigner(u)) {
            reassignOnDesignerUnavailable(u.getId(), u.getUsername());
        }
        if (wasActiveModeler && !isActiveModeler(u)) {
            reassignOnModelerUnavailable(u.getId(), u.getUsername());
        }
        auditLogService.log("USER_UPDATE", "USER", u.getId(), "更新用户信息: " + u.getUsername());
        return UserMapper.toResponse(u);
    }

    @Transactional
    public void delete(long id) {
        User u = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在"));
        if (isActiveDesigner(u) || UserRole.DESIGNER.equals(u.getRole())) {
            // 先改派再删，避免外键/订单挂在已删账号上
            reassignOnDesignerUnavailable(u.getId(), u.getUsername());
        }
        if (isActiveModeler(u) || UserRole.MODELER.equals(u.getRole())) {
            reassignOnModelerUnavailable(u.getId(), u.getUsername());
        }
        userRepository.deleteById(id);
        auditLogService.log("USER_DELETE", "USER", id, "删除用户 ID=" + id);
    }

    @Transactional
    public void deleteBatch(List<Long> userIds) {
        for (Long uid : userIds) {
            if (uid == null) {
                continue;
            }
            userRepository.findById(uid).ifPresent(u -> {
                if (UserRole.DESIGNER.equals(u.getRole())) {
                    reassignOnDesignerUnavailable(u.getId(), u.getUsername());
                }
                if (UserRole.MODELER.equals(u.getRole())) {
                    reassignOnModelerUnavailable(u.getId(), u.getUsername());
                }
            });
        }
        userRepository.deleteAllById(userIds);
        auditLogService.log("USER_DELETE_BATCH", "USER", null, "批量删除用户: " + userIds);
    }

    @Transactional
    public void resetPassword(ResetPasswordBody body) {
        User u = userRepository.findById(body.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在"));
        if (body.getConfirmPassword() != null && !body.getConfirmPassword().equals(body.getNewPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "两次密码不一致");
        }
        u.setPassword(passwordEncoder.encode(body.getNewPassword()));
        userRepository.save(u);
        auditLogService.log("USER_RESET_PASSWORD", "USER", u.getId(), "管理员重置密码: " + u.getUsername());
    }

    @Transactional
    public void enable(long id) {
        User u = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在"));
        u.setStatus(UserStatus.ACTIVE);
        userRepository.save(u);
        auditLogService.log("USER_ENABLE", "USER", u.getId(), "启用用户: " + u.getUsername());
    }

    @Transactional
    public void disable(long id) {
        User u = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在"));
        boolean designerRole = UserRole.DESIGNER.equals(u.getRole());
        boolean modelerRole = UserRole.MODELER.equals(u.getRole());
        u.setStatus(UserStatus.INACTIVE);
        userRepository.save(u);
        if (designerRole) {
            reassignOnDesignerUnavailable(u.getId(), u.getUsername());
        }
        if (modelerRole) {
            reassignOnModelerUnavailable(u.getId(), u.getUsername());
        }
        auditLogService.log("USER_DISABLE", "USER", u.getId(), "禁用用户: " + u.getUsername());
    }

    private static boolean isActiveDesigner(User u) {
        return u != null
                && UserRole.DESIGNER.equals(u.getRole())
                && UserStatus.ACTIVE.equals(u.getStatus());
    }

    private static boolean isActiveModeler(User u) {
        return u != null
                && UserRole.MODELER.equals(u.getRole())
                && UserStatus.ACTIVE.equals(u.getStatus());
    }

    private void reassignOnDesignerUnavailable(long designerId, String username) {
        int n = autoAssignmentService.reassignDesignOrdersFromDisabledDesigner(designerId);
        log.info("设计师 {}({}) 不可用，已改派 {} 笔设计阶段订单", username, designerId, n);
        auditLogService.log("USER_DESIGNER_ORDERS_REASSIGNED", "USER", designerId,
                "设计师不可用，改派设计阶段订单数: " + n);
    }

    private void reassignOnModelerUnavailable(long modelerId, String username) {
        int n = autoAssignmentService.reassignModelingOrdersFromDisabledModeler(modelerId);
        log.info("建模师 {}({}) 不可用，已改派 {} 笔建模阶段订单", username, modelerId, n);
        auditLogService.log("USER_MODELER_ORDERS_REASSIGNED", "USER", modelerId,
                "建模师不可用，改派建模阶段订单数: " + n);
    }

    private static UserStatus parseStatus(String raw, UserStatus defaultStatus) {
        if (raw == null || raw.isBlank()) {
            return defaultStatus;
        }
        try {
            return UserStatus.valueOf(raw.trim());
        } catch (IllegalArgumentException e) {
            return defaultStatus;
        }
    }
}
