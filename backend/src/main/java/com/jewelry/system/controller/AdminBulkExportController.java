package com.jewelry.system.controller;

import com.jewelry.system.dto.admin.ModelingArchivesZipRequest;
import com.jewelry.system.dto.admin.OrderBulkExportPreviewRowDto;
import com.jewelry.system.dto.admin.OrderBulkZipRequest;
import com.jewelry.system.service.AdminBulkExportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/admin/exports")
@RequiredArgsConstructor
@Tag(name = "管理员批量导出", description = "ZIP 打包下载")
public class AdminBulkExportController {

    private final AdminBulkExportService adminBulkExportService;

    @PostMapping("/orders-preview")
    @Operation(summary = "按与订单 ZIP 导出相同的条件预览将包含的订单列表")
    public List<OrderBulkExportPreviewRowDto> previewOrdersZip(@Valid @RequestBody OrderBulkZipRequest body) {
        return adminBulkExportService.previewOrdersForZip(body);
    }

    @PostMapping("/orders-zip")
    @Operation(summary = "按条件批量导出订单及附件 ZIP")
    public ResponseEntity<byte[]> exportOrdersZip(@Valid @RequestBody OrderBulkZipRequest body) throws IOException {
        byte[] zip = adminBulkExportService.zipOrders(body);
        return zipResponse(zip, "orders_export.zip");
    }

    @PostMapping("/modeling-archives-zip")
    @Operation(summary = "批量导出所选订单的建模归档 JSON、标记图及建模相关附件 ZIP")
    public ResponseEntity<byte[]> exportModelingArchivesZip(@Valid @RequestBody ModelingArchivesZipRequest body) throws IOException {
        byte[] zip = adminBulkExportService.zipModelingArchives(body);
        return zipResponse(zip, "modeling_archives_export.zip");
    }

    private static ResponseEntity<byte[]> zipResponse(byte[] zip, String filename) {
        ContentDisposition cd = ContentDisposition.attachment()
                .filename(filename, StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, cd.toString())
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(zip);
    }
}
