package com.jewelry.system.service;

import com.jewelry.system.dto.b2b.*;
import com.jewelry.system.entity.*;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.repository.*;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TaskAssignmentService {

    private final ModelerWorkStatusRepository modelerWorkStatusRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final TaskAssignmentLogRepository taskAssignmentLogRepository;
    private final WebSocketService webSocketService;
    private final AuditLogService auditLogService;

    @Value("${task.timeout.warning.hours:96}")
    private Long timeoutWarningHours;

    @Value("${task.timeout.force.stop.hours:168}")
    private Long forceStopHours;

    // ==============================================
    // 智能任务分配 - 寻找合适的建模师
    // ==============================================
    @Transactional(readOnly = true)
    public Long findSuitableModelerForB2B() {
        List<ModelerWorkStatus> availableModelers = modelerWorkStatusRepository.findB2BAvailable();
        return selectModelerWithPriority(availableModelers, "B2B");
    }

    @Transactional(readOnly = true)
    public Long findSuitableModelerForC2C() {
        List<ModelerWorkStatus> availableModelers = modelerWorkStatusRepository.findC2CAvailable();
        return selectModelerWithPriority(availableModelers, "C2C");
    }

    private Long selectModelerWithPriority(List<ModelerWorkStatus> availableModelers, String taskType) {
        if (availableModelers.isEmpty()) {
            return null;
        }

        // 过滤掉超负载的建模师
        availableModelers = availableModelers.stream()
                .filter(m -> !isModelerOverloaded(m))
                .collect(Collectors.toList());

        if (availableModelers.isEmpty()) {
            return null;
        }

        // 寻找最合适的建模师
        ModelerWorkStatus bestMatch = null;
        double bestScore = -1;

        for (ModelerWorkStatus m : availableModelers) {
            double score = calculateModelerScore(m, taskType);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = m;
            }
        }

        return bestMatch != null ? bestMatch.getUserId() : null;
    }

    private double calculateModelerScore(ModelerWorkStatus status, String taskType) {
        double score = 0;

        // 1. 待办数量越少分数越高
        int todoCount = "B2B".equals(taskType) ? status.getB2bTodoCount() : status.getC2cTodoCount();
        score += Math.max(0, 100 - todoCount * 10);

        // 2. 有优先派单加成（刚切换模式）
        if (hasPriorityBonus(status)) {
            score += 50;
        }

        // 3. 活跃度加成
        if (status.getLastActivityTime() != null) {
            long minutesSinceActivity = Duration.between(status.getLastActivityTime(), LocalDateTime.now()).toMinutes();
            if (minutesSinceActivity < 60) { // 1小时内活动过
                score += 30;
            }
        }

        return score;
    }

    private boolean hasPriorityBonus(ModelerWorkStatus status) {
        if (status.getLastPriorityBonusTime() == null) {
            return false;
        }
        return Duration.between(status.getLastPriorityBonusTime(), LocalDateTime.now()).toHours() < 24;
    }

    // ==============================================
    // 超时检测
    // ==============================================
    @Transactional(readOnly = true)
    public ModelerWorkStatusDetailedDto.TaskTimeoutInfoDto checkModelerTimeouts(Long userId) {
        ModelerWorkStatus status = modelerWorkStatusRepository.findByUserId(userId)
                .orElseGet(() -> createDefaultStatus(userId));

        List<Order> modelerOrders = getModelerActiveOrders(userId);

        int timeoutTaskCount = 0;
        boolean hasTimeoutTasks = false;
        boolean canContinueAssign = true;

        for (Order order : modelerOrders) {
            if (order.getAssignedToModelerAt() != null) {
                long hoursSinceAssignment = Duration.between(
                        order.getAssignedToModelerAt(),
                        LocalDateTime.now()
                ).toHours();

                if (hoursSinceAssignment > timeoutWarningHours) {
                    timeoutTaskCount++;
                    hasTimeoutTasks = true;
                }
                if (hoursSinceAssignment > forceStopHours) {
                    canContinueAssign = false;
                }
            }
        }

        return ModelerWorkStatusDetailedDto.TaskTimeoutInfoDto.builder()
                .hasTimeoutTasks(hasTimeoutTasks)
                .timeoutWarningHours(timeoutWarningHours)
                .forceStopHours(forceStopHours)
                .timeoutTaskCount(timeoutTaskCount)
                .canContinueAssign(canContinueAssign)
                .build();
    }

    @Transactional
    public void updateModelerAutoAssignFlag(Long userId, Boolean enabled) {
        ModelerWorkStatus status = getOrCreateStatus(userId);
        status.setAutoAssignEnabled(enabled);
        modelerWorkStatusRepository.save(status);
        
        auditLogService.log("MODELER_AUTO_ASSIGN_CHANGE", "USER", userId, 
                "自动派单设置为: " + (enabled ? "启用" : "禁用"));
    }

    @Transactional
    public void resumeAutoAssign(Long userId) {
        ModelerWorkStatus status = getOrCreateStatus(userId);
        status.setAutoAssignEnabled(true);
        status.setLastPriorityBonusTime(LocalDateTime.now()); // 给予优先派单奖励
        modelerWorkStatusRepository.save(status);
        
        auditLogService.log("MODELER_RESUME_ASSIGN", "USER", userId, 
                "恢复自动派单，获得24小时优先派单奖励");
    }

    private boolean isModelerOverloaded(ModelerWorkStatus status) {
        // 检查是否有强制超时任务
        List<Order> modelerOrders = getModelerActiveOrders(status.getUserId());
        for (Order order : modelerOrders) {
            if (order.getAssignedToModelerAt() != null) {
                long hoursSinceAssignment = Duration.between(
                        order.getAssignedToModelerAt(),
                        LocalDateTime.now()
                ).toHours();

                if (hoursSinceAssignment > forceStopHours) {
                    return true;
                }
            }
        }
        return false;
    }

    private List<Order> getModelerActiveOrders(Long userId) {
        List<OrderStatus> activeStatuses = Arrays.asList(
                OrderStatus.MODELING,
                OrderStatus.DESIGNING
        );
        return orderRepository.findByModelerIdAndStatusIn(userId, activeStatuses);
    }

    // ==============================================
    // 任务重新分派
    // ==============================================
    @Transactional
    public void reassignTask(TaskReassignRequestDto request) {
        Long currentUserId = SecurityUtils.currentStaffUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));

        Order order = orderRepository.findById(request.getOrderId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));

        // 记录任务流转
        TaskAssignmentLog log = new TaskAssignmentLog();
        log.setOrderId(request.getOrderId());
        log.setTaskType(request.getTaskType());
        log.setFromUserId(request.getFromUserId());
        log.setToUserId(request.getToUserId());
        log.setReassignedBy(currentUserId);
        log.setReason(request.getReason());
        taskAssignmentLogRepository.save(log);

        // 更新订单分配
        if ("DESIGN".equals(request.getTaskType())) {
            order.setDesigner(userRepository.getReferenceById(request.getToUserId()));
        } else if ("MODEL".equals(request.getTaskType())) {
            order.setModeler(userRepository.getReferenceById(request.getToUserId()));
            order.setAssignedToModelerAt(LocalDateTime.now());
            
            // 更新待办计数
            if (request.getFromUserId() != null) {
                decrementModelerTodo(request.getFromUserId(), order.getIsB2b());
            }
            if (request.getToUserId() != null) {
                incrementModelerTodo(request.getToUserId(), order.getIsB2b());
            }
        }
        
        orderRepository.save(order);

        // 发送WebSocket通知
        webSocketService.notifyTaskReassigned(request.getOrderId(), request.getTaskType(), request.getToUserId());
        
        auditLogService.log("TASK_REASSIGNED", "ORDER", request.getOrderId(), 
                "任务重新分派: " + request.getReason());
    }

    // ==============================================
    // 更新建模师待办计数
    // ==============================================
    @Transactional
    public void incrementModelerTodo(Long userId, Boolean isB2b) {
        ModelerWorkStatus status = getOrCreateStatus(userId);
        if (Boolean.TRUE.equals(isB2b)) {
            modelerWorkStatusRepository.incrementB2BTodoCount(userId);
        } else {
            modelerWorkStatusRepository.incrementC2CTodoCount(userId);
        }
    }

    @Transactional
    public void decrementModelerTodo(Long userId, Boolean isB2b) {
        ModelerWorkStatus status = getOrCreateStatus(userId);
        if (Boolean.TRUE.equals(isB2b)) {
            modelerWorkStatusRepository.decrementB2BTodoCount(userId);
        } else {
            modelerWorkStatusRepository.decrementC2CTodoCount(userId);
        }
    }

    @Transactional
    public void updateModelerLastActivity(Long userId) {
        ModelerWorkStatus status = getOrCreateStatus(userId);
        status.setLastActivityTime(LocalDateTime.now());
        modelerWorkStatusRepository.save(status);
    }

    private ModelerWorkStatus getOrCreateStatus(Long userId) {
        return modelerWorkStatusRepository.findByUserId(userId)
                .orElseGet(() -> createDefaultStatus(userId));
    }

    private ModelerWorkStatus createDefaultStatus(Long userId) {
        ModelerWorkStatus status = new ModelerWorkStatus();
        status.setUserId(userId);
        status.setWorkMode(ModelerWorkStatus.WorkMode.AUTO);
        status.setStatus(ModelerWorkStatus.WorkStatus.AVAILABLE);
        status.setTodoCount(0);
        status.setC2cTodoCount(0);
        status.setB2bTodoCount(0);
        status.setAutoAssignEnabled(true);
        return modelerWorkStatusRepository.save(status);
    }
}
