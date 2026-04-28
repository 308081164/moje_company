package com.jewelry.system.service;

import com.jewelry.system.dto.b2b.ModelerWorkStatusDto;
import com.jewelry.system.entity.ModelerWorkStatus;
import com.jewelry.system.entity.ModelerWorkStatus.WorkMode;
import com.jewelry.system.entity.ModelerWorkStatus.WorkStatus;
import com.jewelry.system.entity.User;
import com.jewelry.system.repository.ModelerWorkStatusRepository;
import com.jewelry.system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ModelerWorkStatusService {

    private final ModelerWorkStatusRepository statusRepository;
    private final UserRepository userRepository;

    @Transactional
    public ModelerWorkStatusDto updateWorkMode(Long userId, String mode) {
        ModelerWorkStatus status = getOrCreateStatus(userId);
        status.setWorkMode(WorkMode.valueOf(mode.toUpperCase()));
        statusRepository.save(status);
        return toDto(status);
    }

    @Transactional
    public ModelerWorkStatusDto updateStatus(Long userId, String statusStr, String reason) {
        ModelerWorkStatus status = getOrCreateStatus(userId);
        status.setStatus(WorkStatus.valueOf(statusStr.toUpperCase()));
        status.setPauseReason(reason);
        statusRepository.save(status);
        return toDto(status);
    }

    public ModelerWorkStatusDto getStatus(Long userId) {
        return statusRepository.findByUserId(userId)
                .map(this::toDto)
                .orElse(null);
    }

    public List<ModelerWorkStatusDto> getAllModelerStatus() {
        return userRepository.findByRole("MODELER").stream()
                .map(u -> {
                    ModelerWorkStatus status = statusRepository.findByUserId(u.getId()).orElseGet(() -> {
                        ModelerWorkStatus s = new ModelerWorkStatus();
                        s.setUserId(u.getId());
                        s.setWorkMode(WorkMode.AUTO);
                        s.setStatus(WorkStatus.AVAILABLE);
                        s.setTodoCount(0);
                        return statusRepository.save(s);
                    });
                    return toDto(status, u);
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public Long findAvailableModelerForB2B() {
        List<ModelerWorkStatus> available = statusRepository.findB2BAvailable();
        return findModelerWithLeastTodo(available);
    }

    @Transactional
    public Long findAvailableModelerForC2C() {
        List<ModelerWorkStatus> available = statusRepository.findC2CAvailable();
        return findModelerWithLeastTodo(available);
    }

    @Transactional
    public void assignTask(Long modelerId) {
        statusRepository.incrementTodoCount(modelerId);
    }

    @Transactional
    public void completeTask(Long modelerId) {
        statusRepository.decrementTodoCount(modelerId);
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

    private ModelerWorkStatus getOrCreateStatus(Long userId) {
        return statusRepository.findByUserId(userId)
                .orElseGet(() -> {
                    ModelerWorkStatus status = new ModelerWorkStatus();
                    status.setUserId(userId);
                    status.setWorkMode(WorkMode.AUTO);
                    status.setStatus(WorkStatus.AVAILABLE);
                    status.setTodoCount(0);
                    return status;
                });
    }

    private ModelerWorkStatusDto toDto(ModelerWorkStatus status) {
        ModelerWorkStatusDto dto = new ModelerWorkStatusDto();
        dto.setUserId(status.getUserId());
        dto.setWorkMode(status.getWorkMode().name());
        dto.setStatus(status.getStatus().name());
        dto.setTodoCount(status.getTodoCount());
        dto.setPauseReason(status.getPauseReason());
        return dto;
    }

    private ModelerWorkStatusDto toDto(ModelerWorkStatus status, User user) {
        ModelerWorkStatusDto dto = toDto(status);
        dto.setUsername(user.getUsername());
        dto.setRealName(user.getRealName());
        return dto;
    }
}