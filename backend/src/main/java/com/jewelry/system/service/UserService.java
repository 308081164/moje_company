package com.jewelry.system.service;

import com.jewelry.system.dto.user.*;
import com.jewelry.system.entity.User;
import com.jewelry.system.enums.UserRole;
import com.jewelry.system.enums.UserStatus;
import com.jewelry.system.repository.UserRepository;
import com.jewelry.system.util.ApiRoleMapper;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
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

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;

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
        auditLogService.log("USER_UPDATE", "USER", u.getId(), "更新用户信息: " + u.getUsername());
        return UserMapper.toResponse(u);
    }

    @Transactional
    public void delete(long id) {
        if (!userRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在");
        }
        userRepository.deleteById(id);
        auditLogService.log("USER_DELETE", "USER", id, "删除用户 ID=" + id);
    }

    @Transactional
    public void deleteBatch(List<Long> userIds) {
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
        u.setStatus(UserStatus.INACTIVE);
        userRepository.save(u);
        auditLogService.log("USER_DISABLE", "USER", u.getId(), "禁用用户: " + u.getUsername());
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
