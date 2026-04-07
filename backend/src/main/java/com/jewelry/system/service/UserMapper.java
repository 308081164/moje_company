package com.jewelry.system.service;

import com.jewelry.system.dto.user.UserResponse;
import com.jewelry.system.entity.User;
import com.jewelry.system.util.ApiRoleMapper;

import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;

public final class UserMapper {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private UserMapper() {
    }

    public static UserResponse toResponse(User u) {
        List<String> permissions = Collections.emptyList();
        return UserResponse.builder()
                .id(u.getId())
                .username(u.getUsername())
                .realName(u.getRealName())
                .email(u.getEmail())
                .phone(u.getPhone())
                .role(ApiRoleMapper.toApiRole(u.getRole()))
                .roleDescription(u.getRole() != null ? u.getRole().getDescription() : null)
                .status(u.getStatus() != null ? u.getStatus().name() : null)
                .permissions(permissions)
                .createdAt(u.getCreatedAt() != null ? ISO.format(u.getCreatedAt()) : null)
                .updatedAt(u.getUpdatedAt() != null ? ISO.format(u.getUpdatedAt()) : null)
                .build();
    }
}
