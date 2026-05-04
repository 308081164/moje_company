package com.jewelry.system.service;

import com.jewelry.system.dto.b2b.ModelerWorkStatusDto;
import com.jewelry.system.entity.ModelerWorkStatus;
import com.jewelry.system.entity.ModelerWorkStatus.WorkMode;
import com.jewelry.system.entity.ModelerWorkStatus.WorkStatus;
import com.jewelry.system.entity.User;
import com.jewelry.system.repository.ModelerWorkStatusRepository;
import com.jewelry.system.repository.UserRepository;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ModelerWorkStatusService {

    private final ModelerWorkStatusRepository statusRepository;
    private final UserRepository userRepository;
    private final TaskAssignmentService taskAssignmentService;

    @Transactional
    public ModelerWorkStatusDto getCurrentModelerStatus() {
        return SecurityUtils.currentUserId()
                .map(this::getOrCreateStatus)
                .orElse(null);
    }

    @Transactional
    public ModelerWorkStatusDto updateWorkMode(String workMode) {
        Long userId = SecurityUtils.currentUserId().orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        ModelerWorkStatus status = statusRepository.findByUserId(userId).orElseGet(() -> createDefaultStatus(userId));
        
        status.setWorkMode(WorkMode.valueOf(workMode));
        status.setLastPriorityBonusTime(LocalDateTime.now()); // 切换模式给24小时优先派单奖励
        statusRepository.save(status);
        return toDto(status);
    }

    @Transactional
    public ModelerWorkStatusDto updateWorkStatus(String workStatus, String pauseReason) {
        Long userId = SecurityUtils.currentUserId().orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        ModelerWorkStatus status = statusRepository.findByUserId(userId).orElseGet(() -> createDefaultStatus(userId));
        
        status.setStatus(WorkStatus.valueOf(workStatus));
        if ("PAUSED".equals(workStatus)) {
            status.setPauseReason(pauseReason);
            status.setAutoAssignEnabled(false); // 暂停时关闭自动派单
        } else {
            status.setPauseReason(null);
            status.setAutoAssignEnabled(true); // 恢复时开启自动派单
        }
        
        statusRepository.save(status);
        return toDto(status);
    }

    @Transactional
    public ModelerWorkStatusDto toggleAutoAssign(Boolean enabled) {
        Long userId = SecurityUtils.currentUserId().orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        ModelerWorkStatus status = statusRepository.findByUserId(userId).orElseGet(() -> createDefaultStatus(userId));
        
        if (Boolean.TRUE.equals(enabled)) {
            taskAssignmentService.resumeAutoAssign(userId);
        } else {
            taskAssignmentService.updateModelerAutoAssignFlag(userId, false);
        }
        
        status.setAutoAssignEnabled(enabled);
        statusRepository.save(status);
        return toDto(status);
    }

    @Transactional
    public void assignTask(Long userId) {
        statusRepository.incrementTodoCount(userId);
    }

    @Transactional
    public void completeTask(Long userId) {
        statusRepository.decrementTodoCount(userId);
    }

    public Long findAvailableModelerForB2B() {
        List<ModelerWorkStatus> available = statusRepository.findB2BAvailable();
        return findModelerWithLeastTodo(available);
    }

    public Long findAvailableModelerForC2C() {
        List<ModelerWorkStatus> available = statusRepository.findC2CAvailable();
        return findModelerWithLeastTodo(available);
    }

    @Transactional(readOnly = true)
    public List<ModelerWorkStatusDto> getAllModelerStatus() {
        return userRepository.findByRole("MODELER").stream()
                .map(u -> {
                    ModelerWorkStatus status = statusRepository.findByUserId(u.getId()).orElseGet(() -> {
                        ModelerWorkStatus s = new ModelerWorkStatus();
                        s.setUserId(u.getId());
                        s.setWorkMode(WorkMode.AUTO);
                        s.setStatus(WorkStatus.AVAILABLE);
                        s.setTodoCount(0);
                        s.setC2cTodoCount(0);
                        s.setB2bTodoCount(0);
                        s.setAutoAssignEnabled(true);
                        return statusRepository.save(s);
                    });
                    return toDto(status, u);
                })
                .collect(Collectors.toList());
    }

    private Long findModelerWithLeastTodo(List<ModelerWorkStatus> available) {
        if (available.isEmpty()) {
            return null;
        }
        return available.stream()
                .min((a, b) -> Integer.compare(a.getTodoCount(), b.getTodoCount()))
                .map(ModelerWorkStatus::getUserId)
                .orElse(null);
    }

    private ModelerWorkStatus createDefaultStatus(Long userId) {
        ModelerWorkStatus status = new ModelerWorkStatus();
        status.setUserId(userId);
        status.setWorkMode(WorkMode.AUTO);
        status.setStatus(WorkStatus.AVAILABLE);
        status.setTodoCount(0);
        status.setC2cTodoCount(0);
        status.setB2bTodoCount(0);
        status.setAutoAssignEnabled(true);
        return statusRepository.save(status);
    }

    private ModelerWorkStatusDto getOrCreateStatus(Long userId) {
        return statusRepository.findByUserId(userId)
                .map(this::toDto)
                .orElseGet(() -> toDto(createDefaultStatus(userId)));
    }

    private ModelerWorkStatusDto toDto(ModelerWorkStatus status) {
        ModelerWorkStatusDto dto = new ModelerWorkStatusDto();
        dto.setUserId(status.getUserId());
        dto.setWorkMode(status.getWorkMode() != null ? status.getWorkMode().name() : "AUTO");
        dto.setStatus(status.getStatus() != null ? status.getStatus().name() : "AVAILABLE");
        dto.setTodoCount(status.getTodoCount() != null ? status.getTodoCount() : 0);
        dto.setC2cTodoCount(status.getC2cTodoCount() != null ? status.getC2cTodoCount() : 0);
        dto.setB2bTodoCount(status.getB2bTodoCount() != null ? status.getB2bTodoCount() : 0);
        dto.setAutoAssignEnabled(status.getAutoAssignEnabled() != null ? status.getAutoAssignEnabled() : true);
        dto.setPauseReason(status.getPauseReason());
        
        if (status.getUserId() != null) {
            userRepository.findById(status.getUserId()).ifPresent(user -> {
                dto.setUsername(user.getUsername());
                dto.setRealName(user.getRealName());
            });
        }
        
        return dto;
    }

    private ModelerWorkStatusDto toDto(ModelerWorkStatus status, User user) {
        ModelerWorkStatusDto dto = toDto(status);
        dto.setUsername(user.getUsername());
        dto.setRealName(user.getRealName());
        return dto;
    }
}
