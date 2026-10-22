package com.jewelry.system.controller;

import com.jewelry.system.dto.order.OrderProductionFollowLogDto;
import com.jewelry.system.dto.order.ProductionSyncDtos;
import com.jewelry.system.service.ProductionSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/orders/production-sync")
@RequiredArgsConstructor
@Tag(name = "工序跟单", description = "现场按工序拍照，回公司后拖到对应单件同步进度")
public class ProductionSyncController {

    private final ProductionSyncService productionSyncService;

    @GetMapping("/processes")
    @Operation(summary = "工序列表及未匹配照片数量")
    public List<ProductionSyncDtos.ProcessSummary> processes() {
        return productionSyncService.summaries();
    }

    @GetMapping
    @Operation(summary = "某工序的进度同步工作台")
    public ProductionSyncDtos.Board board(@RequestParam String process) {
        return productionSyncService.board(process);
    }

    @PostMapping(value = "/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "把现场照片存入该工序的照片池")
    public ProductionSyncDtos.PoolPhoto upload(
            @RequestParam String process,
            @RequestPart("file") MultipartFile file
    ) throws IOException {
        return productionSyncService.upload(process, file);
    }

    @DeleteMapping("/photos/{photoId}")
    @Operation(summary = "删除尚未匹配的现场照片")
    public void discard(@PathVariable long photoId) {
        productionSyncService.discard(photoId);
    }

    @PostMapping("/match")
    @Operation(summary = "把照片匹配到单件，并通知客户")
    public OrderProductionFollowLogDto match(@RequestBody ProductionSyncDtos.MatchRequest body) {
        return productionSyncService.match(body);
    }
}
