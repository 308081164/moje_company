package com.jewelry.system.controller;

import com.jewelry.system.dto.b2b.*;
import com.jewelry.system.dto.order.FileInfoDto;
import com.jewelry.system.dto.order.OrderInfoDto;
import com.jewelry.system.service.*;
import com.jewelry.system.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
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
    private final TaskAssignmentService taskAssignmentService;
    private final OrderFileService orderFileService;

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

    @PostMapping(value = "/order/create-with-files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "创建B端订单并上传文件")
    public ResponseEntity<B2BOrderAccessDto> createOrderWithFiles(
            @RequestPart("orderData") B2BOrderCreateRequest req,
            @RequestPart(value = "files", required = false) List<MultipartFile> files) {
        
        B2BOrderAccessDto result = orderService.createOrder(req);
        
        // 如果有文件，上传文件到订单
        if (files != null && !files.isEmpty()) {
            Long orderId = linkService.getOrderEntityByToken(result.getToken()).getId();
            for (MultipartFile file : files) {
                try {
                    orderFileService.uploadDesignFile(orderId, file, "B端客户上传");
                } catch (IOException e) {
                    throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "文件上传失败");
                }
            }
        }
        
        return ResponseEntity.ok(result);
    }

    @GetMapping("/order/{token}")
    @Operation(summary = "通过链接访问订单")
    public ResponseEntity<OrderInfoDto> getOrderByToken(@PathVariable String token) {
        return ResponseEntity.ok(orderService.getOrderByToken(token));
    }

    @GetMapping("/order/{token}/files")
    @Operation(summary = "通过链接获取订单文件列表")
    public ResponseEntity<List<FileInfoDto>> getOrderFilesByToken(@PathVariable String token) {
        Long orderId = linkService.getOrderEntityByToken(token).getId();
        return ResponseEntity.ok(orderFileService.listForOrder(orderId));
    }

    @GetMapping("/client/orders")
    @Operation(summary = "获取客户订单列表")
    public ResponseEntity<List<OrderInfoDto>> getClientOrders(@RequestParam Long clientId) {
        return ResponseEntity.ok(orderService.getClientOrders(clientId));
    }

    @GetMapping("/modeler/status")
    @Operation(summary = "获取当前建模师工作状态")
    public ResponseEntity<ModelerWorkStatusDto> getModelerStatus() {
        return ResponseEntity.ok(workStatusService.getCurrentModelerStatus());
    }

    @PutMapping("/modeler/work-mode")
    @Operation(summary = "切换建模师工作模式")
    public ResponseEntity<ModelerWorkStatusDto> updateWorkMode(@RequestBody Map<String, String> body) {
        String mode = body.get("mode");
        if (mode == null || mode.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "工作模式不能为空");
        }
        return ResponseEntity.ok(workStatusService.updateWorkMode(mode));
    }

    @PutMapping("/modeler/work-status")
    @Operation(summary = "更新建模师工作状态")
    public ResponseEntity<ModelerWorkStatusDto> updateWorkStatus(@RequestBody Map<String, String> body) {
        String status = body.get("status");
        String reason = body.get("reason");
        if (status == null || status.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "工作状态不能为空");
        }
        return ResponseEntity.ok(workStatusService.updateWorkStatus(status, reason));
    }

    @PutMapping("/modeler/auto-assign")
    @Operation(summary = "切换自动派单开关")
    public ResponseEntity<ModelerWorkStatusDto> toggleAutoAssign(@RequestBody Map<String, Boolean> body) {
        Boolean enabled = body.get("enabled");
        if (enabled == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "enabled不能为空");
        }
        return ResponseEntity.ok(workStatusService.toggleAutoAssign(enabled));
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
