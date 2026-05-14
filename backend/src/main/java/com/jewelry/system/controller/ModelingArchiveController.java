package com.jewelry.system.controller;

import com.jewelry.system.dto.modeling.ModelingArchiveDto;
import com.jewelry.system.dto.order.FileInfoDto;
import com.jewelry.system.dto.order.OrderInfoDto;
import com.jewelry.system.service.ModelingArchiveService;
import com.jewelry.system.service.OrderFileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
@Tag(name = "建模材料归档", description = "信息化数据归档师 / 管理员 / 售中客服共享池")
public class ModelingArchiveController {

    private final ModelingArchiveService modelingArchiveService;
    private final OrderFileService orderFileService;

    @GetMapping("/workbench/modeling-archive/pool")
    @Operation(summary = "待归档建模任务池（有建模信息且尚未被他人提交锁定）")
    public ResponseEntity<Page<OrderInfoDto>> pool(Pageable pageable) {
        return ResponseEntity.ok(modelingArchiveService.pageSharedPool(pageable));
    }

    @GetMapping("/{orderId}/modeling-archive")
    @Operation(summary = "获取订单建模归档")
    public ResponseEntity<ModelingArchiveDto> get(@PathVariable long orderId) {
        return ResponseEntity.ok(modelingArchiveService.getArchive(orderId));
    }

    @PutMapping("/{orderId}/modeling-archive")
    @Operation(summary = "保存建模归档草稿（不锁定）")
    public ResponseEntity<ModelingArchiveDto> put(@PathVariable long orderId, @RequestBody ModelingArchiveDto body) {
        body.setOrderId(orderId);
        return ResponseEntity.ok(modelingArchiveService.saveDraft(orderId, body));
    }

    @PostMapping("/{orderId}/modeling-archive/submit")
    @Operation(summary = "提交归档（首次锁定，他人不可再次提交）")
    public ResponseEntity<ModelingArchiveDto> submit(@PathVariable long orderId) {
        return ResponseEntity.ok(modelingArchiveService.submit(orderId));
    }

    @PostMapping(value = "/{orderId}/modeling-archive/marker-upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "上传样式标记截图（写入订单附件，返回文件信息）")
    public ResponseEntity<FileInfoDto> uploadMarker(
            @PathVariable long orderId,
            @RequestPart("file") MultipartFile file
    ) throws IOException {
        return ResponseEntity.ok(orderFileService.uploadArchiveMarkerFile(orderId, file));
    }
}
