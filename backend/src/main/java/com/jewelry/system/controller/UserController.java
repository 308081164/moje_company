package com.jewelry.system.controller;

import com.jewelry.system.dto.user.*;
import com.jewelry.system.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
@Tag(name = "用户管理", description = "用户增删改查、启停、重置密码")
public class UserController {

    private final UserService userService;

    @GetMapping
    @Operation(summary = "用户分页列表")
    public Page<UserResponse> list(
            @RequestParam(required = false) String username,
            @RequestParam(required = false) String realName,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            Pageable pageable
    ) {
        return userService.list(username, realName, role, status, pageable);
    }

    @GetMapping("/{id:\\d+}")
    @Operation(summary = "用户详情")
    public UserResponse get(@PathVariable long id) {
        return userService.getById(id);
    }

    @PostMapping
    @Operation(summary = "创建用户")
    public UserResponse create(@Valid @RequestBody UserCreateRequest request) {
        return userService.create(request);
    }

    @PutMapping("/{id:\\d+}")
    @Operation(summary = "更新用户")
    public UserResponse update(@PathVariable long id, @RequestBody UserUpdateRequest request) {
        return userService.update(id, request);
    }

    @DeleteMapping("/{id:\\d+}")
    @Operation(summary = "删除用户")
    public void delete(@PathVariable long id) {
        userService.delete(id);
    }

    @DeleteMapping("/batch")
    @Operation(summary = "批量删除用户")
    public void deleteBatch(@Valid @RequestBody UserBatchDeleteRequest request) {
        userService.deleteBatch(request.getUserIds());
    }

    @PutMapping("/reset-password")
    @Operation(summary = "管理员重置密码")
    public void resetPassword(@Valid @RequestBody ResetPasswordBody body) {
        userService.resetPassword(body);
    }

    @PutMapping("/{id:\\d+}/enable")
    @Operation(summary = "启用用户")
    public void enable(@PathVariable long id) {
        userService.enable(id);
    }

    @PutMapping("/{id:\\d+}/disable")
    @Operation(summary = "禁用用户")
    public void disable(@PathVariable long id) {
        userService.disable(id);
    }
}
