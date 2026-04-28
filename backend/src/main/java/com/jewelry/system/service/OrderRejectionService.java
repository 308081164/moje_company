package com.jewelry.system.service;

import com.jewelry.system.dto.b2b.OrderRejectionFlowDto;
import com.jewelry.system.dto.b2b.OrderRejectionRequestDto;
import com.jewelry.system.entity.OrderRejectionFlow;
import com.jewelry.system.repository.OrderRejectionFlowRepository;
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
public class OrderRejectionService {

    private final OrderRejectionFlowRepository orderRejectionFlowRepository;
    private final AuditLogService auditLogService;

    // ==============================================
    // 创建驳回流程
    // ==============================================
    @Transactional
    public OrderRejectionFlowDto createRejection(OrderRejectionRequestDto request) {
        Long currentUserId = SecurityUtils.currentUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));

        OrderRejectionFlow flow = new OrderRejectionFlow();
        flow.setOrderId(request.getOrderId());
        flow.setRejectedBy(currentUserId);
        flow.setRejectionType(request.getRejectionType());
        flow.setRejectionReasons(request.getRejectionReasons());
        flow.setCurrentStage("PENDING_FIX");
        flow.setLastStatusUpdateBy(currentUserId);
        flow.setLastStatusUpdateAt(LocalDateTime.now());
        
        orderRejectionFlowRepository.save(flow);

        auditLogService.log("ORDER_REJECTED", "ORDER", request.getOrderId(), 
                "创建驳回流程: " + request.getRejectionType());

        return toDto(flow);
    }

    // ==============================================
    // 更新驳回状态 - 修复中
    // ==============================================
    @Transactional
    public OrderRejectionFlowDto updateStageToInFix(Long flowId) {
        Long currentUserId = SecurityUtils.currentUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));

        OrderRejectionFlow flow = orderRejectionFlowRepository.findById(flowId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "驳回流程不存在"));

        flow.setCurrentStage("IN_FIX");
        flow.setLastStatusUpdateBy(currentUserId);
        flow.setLastStatusUpdateAt(LocalDateTime.now());
        orderRejectionFlowRepository.save(flow);

        auditLogService.log("REJECTION_IN_FIX", "ORDER", flow.getOrderId(), 
                "驳回流程进入修复中阶段");

        return toDto(flow);
    }

    // ==============================================
    // 重新提交
    // ==============================================
    @Transactional
    public OrderRejectionFlowDto resubmit(Long flowId) {
        Long currentUserId = SecurityUtils.currentUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));

        OrderRejectionFlow flow = orderRejectionFlowRepository.findById(flowId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "驳回流程不存在"));

        flow.setCurrentStage("RESUBMITTED");
        flow.setResubmittedAt(LocalDateTime.now());
        flow.setLastStatusUpdateBy(currentUserId);
        flow.setLastStatusUpdateAt(LocalDateTime.now());
        orderRejectionFlowRepository.save(flow);

        auditLogService.log("REJECTION_RESUBMITTED", "ORDER", flow.getOrderId(), 
                "驳回内容重新提交审核");

        return toDto(flow);
    }

    // ==============================================
    // 审核通过 - 解决
    // ==============================================
    @Transactional
    public OrderRejectionFlowDto resolveRejection(Long flowId) {
        Long currentUserId = SecurityUtils.currentUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));

        OrderRejectionFlow flow = orderRejectionFlowRepository.findById(flowId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "驳回流程不存在"));

        flow.setCurrentStage("RESOLVED");
        flow.setResolvedAt(LocalDateTime.now());
        flow.setLastStatusUpdateBy(currentUserId);
        flow.setLastStatusUpdateAt(LocalDateTime.now());
        orderRejectionFlowRepository.save(flow);

        auditLogService.log("REJECTION_RESOLVED", "ORDER", flow.getOrderId(), 
                "驳回流程解决完成");

        return toDto(flow);
    }

    // ==============================================
    // 查询驳回流程
    // ==============================================
    public OrderRejectionFlowDto getRejectionFlow(Long flowId) {
        OrderRejectionFlow flow = orderRejectionFlowRepository.findById(flowId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "驳回流程不存在"));
        return toDto(flow);
    }

    public List<OrderRejectionFlowDto> getRejectionsByOrder(Long orderId) {
        return orderRejectionFlowRepository.findByOrderId(orderId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public List<OrderRejectionFlowDto> getRejectionsByStage(String stage) {
        return orderRejectionFlowRepository.findByCurrentStage(stage).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    private OrderRejectionFlowDto toDto(OrderRejectionFlow flow) {
        return OrderRejectionFlowDto.builder()
                .id(flow.getId())
                .orderId(flow.getOrderId())
                .rejectedBy(flow.getRejectedBy() != null ? String.valueOf(flow.getRejectedBy()) : null)
                .rejectionType(flow.getRejectionType())
                .rejectionReasons(flow.getRejectionReasons())
                .currentStage(flow.getCurrentStage())
                .lastStatusUpdateBy(flow.getLastStatusUpdateBy() != null ? String.valueOf(flow.getLastStatusUpdateBy()) : null)
                .lastStatusUpdateAt(flow.getLastStatusUpdateAt())
                .resubmittedAt(flow.getResubmittedAt())
                .resolvedAt(flow.getResolvedAt())
                .createdAt(flow.getCreatedAt())
                .build();
    }
}
