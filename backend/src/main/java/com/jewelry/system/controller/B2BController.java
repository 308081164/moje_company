package com.jewelry.system.controller;

import com.jewelry.system.dto.b2b.*;
import com.jewelry.system.dto.order.OrderInfoDto;
import com.jewelry.system.service.*;
import com.jewelry.system.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/b2b")
@RequiredArgsConstructor
@Tag(name = "B端客户服务", description = "B端客户订单创建与访问")
public class B2BController {

    private final B2BClientService clientService;
    private final B2BOrderService orderService;
    private final OrderAccessLinkService linkService;
    private final ModelerWorkStatusService workStatusService;

    @PostMapping("/client/register")
    @Operation(summary = "B端客户注册")
    public ResponseEntity<B2BClientResponse> register(@RequestBody B2BClientRegisterRequest req) {
        return ResponseEntity.ok(clientService.register(req));
    }

    @PostMapping("/client/login")
    @Operation(summary = "B端客户登录")
    public ResponseEntity<B2BClientResponse> login(@RequestBody B2BClientLoginRequest req) {
        return ResponseEntity.ok(clientService.login(req));
    }

    @PostMapping("/order/create")
    @Operation(summary = "创建B端订单")
    public ResponseEntity<B2BOrderAccessDto> createOrder(@RequestBody B2BOrderCreateRequest req) {
        return ResponseEntity.ok(orderService.createOrder(req));
    }

    @GetMapping("/order/{token}")
    @Operation(summary = "通过链接访问订单")
    public ResponseEntity<OrderInfoDto> getOrderByToken(@PathVariable String token) {
        return ResponseEntity.ok(orderService.getOrderByToken(token));
    }

    @GetMapping("/client/orders")
    @Operation(summary = "获取客户订单列表")
    public ResponseEntity<List<OrderInfoDto>> getClientOrders(@RequestParam Long clientId) {
        return ResponseEntity.ok(orderService.getClientOrders(clientId));
    }

    @GetMapping("/modeler/status")
    @Operation(summary = "获取当前建模师工作状态")
    public ResponseEntity<ModelerWorkStatusDto> getModelerStatus() {
        Long userId = SecurityUtils.currentUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        ModelerWorkStatusDto status = workStatusService.getStatus(userId);
        if (status == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "工作状态不存在");
        }
        return ResponseEntity.ok(status);
    }

    @PutMapping("/modeler/work-mode")
    @Operation(summary = "切换建模师工作模式")
    public ResponseEntity<ModelerWorkStatusDto> updateWorkMode(@RequestBody Map<String, String> body) {
        Long userId = SecurityUtils.currentUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        String mode = body.get("mode");
        if (mode == null || mode.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "工作模式不能为空");
        }
        return ResponseEntity.ok(workStatusService.updateWorkMode(userId, mode));
    }

    @PutMapping("/modeler/work-status")
    @Operation(summary = "更新建模师工作状态")
    public ResponseEntity<ModelerWorkStatusDto> updateWorkStatus(@RequestBody Map<String, String> body) {
        Long userId = SecurityUtils.currentUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        String status = body.get("status");
        String reason = body.get("reason");
        if (status == null || status.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "工作状态不能为空");
        }
        return ResponseEntity.ok(workStatusService.updateStatus(userId, status, reason));
    }

    @GetMapping("/modeler/all-status")
    @Operation(summary = "获取所有建模师状态（管理员）")
    public ResponseEntity<List<ModelerWorkStatusDto>> getAllModelerStatus() {
        if (!"ADMIN".equals(SecurityUtils.currentRoleApi().orElse(null))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可查看");
        }
        return ResponseEntity.ok(workStatusService.getAllModelerStatus());
    }
}