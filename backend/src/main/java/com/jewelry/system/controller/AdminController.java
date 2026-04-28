package com.jewelry.system.controller;

import com.jewelry.system.dto.b2b.*;
import com.jewelry.system.dto.order.OrderStatisticsDto;
import com.jewelry.system.entity.Order;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.service.*;
import com.jewelry.system.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Tag(name = "管理员-系统管理", description = "管理员数据统计、任务分配、驳回流程等")
public class AdminController {

    private final OrderRepository orderRepository;
    private final TaskAssignmentService taskAssignmentService;
    private final OrderRejectionService orderRejectionService;
    private final ModelerWorkStatusService modelerWorkStatusService;
    private final OrderStatisticsService orderStatisticsService;

    @Value("${task.timeout.warning.hours:96}")
    private Long timeoutWarningHours;

    @Value("${task.timeout.force.stop.hours:168}")
    private Long forceStopHours;

    // ==============================================
    // 1. 数据统计 - C端/B端统筹
    // ==============================================
    @GetMapping("/statistics/overview")
    @Operation(summary = "C端/B端整体数据统计")
    public OrderStatisticsOverviewDto getOverviewStatistics() {
        LocalDate today = LocalDate.now();
        LocalDateTime todayStart = today.atStartOfDay();

        // 整体统计
        long totalOrders = orderRepository.count();
        long completedOrders = orderRepository.countByStatus(OrderStatus.COMPLETED);
        long pendingOrders = totalOrders - completedOrders - orderRepository.countByStatus(OrderStatus.CANCELLED);
        BigDecimal totalRevenue = orderRepository.sumAllDeposit();

        // C端统计
        long c2cTotal = orderRepository.countByIsB2b(false);
        long c2cCompleted = orderRepository.countByIsB2bAndStatus(false, OrderStatus.COMPLETED);
        BigDecimal c2cRevenue = orderRepository.sumDepositByIsB2b(false);
        long c2cPending = c2cTotal - c2cCompleted - countCancelled(false);

        // B端统计
        long b2bTotal = orderRepository.countByIsB2b(true);
        long b2bCompleted = orderRepository.countByIsB2bAndStatus(true, OrderStatus.COMPLETED);
        BigDecimal b2bRevenue = orderRepository.sumDepositByIsB2b(true);
        long b2bPending = b2bTotal - b2bCompleted - countCancelled(true);

        // 今日统计
        long todayNew = orderRepository.countByCreatedAtAfter(todayStart);
        long todayCompleted = orderRepository.countByStatusAndUpdatedAtAfter(OrderStatus.COMPLETED, todayStart);

        return OrderStatisticsOverviewDto.builder()
                .totalOrders(totalOrders)
                .completedOrders(completedOrders)
                .pendingOrders(pendingOrders)
                .totalRevenue(totalRevenue != null ? totalRevenue.doubleValue() : 0)
                
                .c2cTotalOrders(c2cTotal)
                .c2cCompletedOrders(c2cCompleted)
                .c2cPendingOrders(c2cPending)
                .c2cRevenue(c2cRevenue != null ? c2cRevenue.doubleValue() : 0)
                
                .b2bTotalOrders(b2bTotal)
                .b2bCompletedOrders(b2bCompleted)
                .b2bPendingOrders(b2bPending)
                .b2bRevenue(b2bRevenue != null ? b2bRevenue.doubleValue() : 0)
                
                .todayNewOrders(todayNew)
                .todayCompletedOrders(todayCompleted)
                .build();
    }

    private long countCancelled(boolean isB2b) {
        return orderRepository.countByIsB2bAndStatus(isB2b, OrderStatus.CANCELLED);
    }

    // ==============================================
    // 2. 建模师管理
    // ==============================================
    @GetMapping("/modelers/status-all")
    @Operation(summary = "获取所有建模师详细状态")
    public List<ModelerWorkStatusDetailedDto> getAllModelerStatusDetails() {
        if (!"ADMIN".equals(SecurityUtils.currentRoleApi().orElse(null))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可查看");
        }

        List<ModelerWorkStatusDto> basicStatusList = modelerWorkStatusService.getAllModelerStatus();
        
        return basicStatusList.stream()
                .map(dto -> {
                    ModelerWorkStatusDetailedDto.TaskTimeoutInfoDto timeoutInfo = 
                            taskAssignmentService.checkModelerTimeouts(dto.getUserId());
                    
                    return ModelerWorkStatusDetailedDto.builder()
                            .userId(dto.getUserId())
                            .username(dto.getUsername())
                            .realName(dto.getRealName())
                            .workMode(dto.getWorkMode())
                            .status(dto.getStatus())
                            .totalTodoCount(dto.getTodoCount())
                            .c2cTodoCount(dto.getC2cTodoCount())
                            .b2bTodoCount(dto.getB2bTodoCount())
                            .autoAssignEnabled(dto.getAutoAssignEnabled())
                            .reasonForPause(dto.getPauseReason())
                            .timeoutInfo(timeoutInfo)
                            .isOverloaded(!timeoutInfo.getCanContinueAssign())
                            .build();
                })
                .collect(Collectors.toList());
    }

    // ==============================================
    // 3. 任务重新分派
    // ==============================================
    @PostMapping("/task/reassign")
    @Operation(summary = "重新分派任务")
    public void reassignTask(@RequestBody TaskReassignRequestDto request) {
        if (!"ADMIN".equals(SecurityUtils.currentRoleApi().orElse(null)) && 
            !"SALES_MID".equals(SecurityUtils.currentRoleApi().orElse(null))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员或售中客服可操作");
        }
        taskAssignmentService.reassignTask(request);
    }

    // ==============================================
    // 4. 驳回流程管理
    // ==============================================
    @PostMapping("/rejections/create")
    @Operation(summary = "创建驳回流程")
    public OrderRejectionFlowDto createRejection(@RequestBody OrderRejectionRequestDto request) {
        return orderRejectionService.createRejection(request);
    }

    @PutMapping("/rejections/{flowId}/in-fix")
    @Operation(summary = "标记为修复中")
    public OrderRejectionFlowDto markInFix(@PathVariable Long flowId) {
        return orderRejectionService.updateStageToInFix(flowId);
    }

    @PutMapping("/rejections/{flowId}/resubmit")
    @Operation(summary = "重新提交")
    public OrderRejectionFlowDto resubmit(@PathVariable Long flowId) {
        return orderRejectionService.resubmit(flowId);
    }

    @PutMapping("/rejections/{flowId}/resolve")
    @Operation(summary = "解决驳回")
    public OrderRejectionFlowDto resolve(@PathVariable Long flowId) {
        return orderRejectionService.resolveRejection(flowId);
    }

    @GetMapping("/rejections/order/{orderId}")
    @Operation(summary = "获取订单的驳回流程")
    public List<OrderRejectionFlowDto> getOrderRejections(@PathVariable Long orderId) {
        return orderRejectionService.getRejectionsByOrder(orderId);
    }

    @GetMapping("/rejections/stage/{stage}")
    @Operation(summary = "获取指定阶段的驳回流程")
    public List<OrderRejectionFlowDto> getRejectionsByStage(@PathVariable String stage) {
        return orderRejectionService.getRejectionsByStage(stage);
    }

    // ==============================================
    // 5. 超时配置
    // ==============================================
    @GetMapping("/timeout-config")
    @Operation(summary = "获取超时配置")
    public java.util.Map<String, Long> getTimeoutConfig() {
        return java.util.Map.of(
                "warningHours", timeoutWarningHours,
                "forceStopHours", forceStopHours
        );
    }
}
