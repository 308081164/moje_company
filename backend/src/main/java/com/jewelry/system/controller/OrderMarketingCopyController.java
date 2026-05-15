package com.jewelry.system.controller;

import com.jewelry.system.dto.marketing.MarketingCopyZipRequest;
import com.jewelry.system.dto.marketing.OrderMarketingCopyDto;
import com.jewelry.system.dto.order.OrderInfoDto;
import com.jewelry.system.service.OrderMarketingCopyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/orders/workbench/marketing-copy")
@RequiredArgsConstructor
@Tag(name = "营销文案", description = "售前/管理员/售中：待生成池、通义千问生成、ZIP 导出")
public class OrderMarketingCopyController {

    private final OrderMarketingCopyService orderMarketingCopyService;

    @GetMapping("/pending")
    @Operation(summary = "待生成营销文案的已完成订单")
    public Page<OrderInfoDto> pending(Pageable pageable) {
        return orderMarketingCopyService.pagePending(pageable);
    }

    @GetMapping("/order/{orderId}")
    @Operation(summary = "获取订单营销文案内容")
    public OrderMarketingCopyDto get(@PathVariable long orderId) {
        return orderMarketingCopyService.getDto(orderId);
    }

    @PostMapping("/order/{orderId}/generate")
    @Operation(summary = "一键调用通义千问生成并持久化三类文案")
    public OrderMarketingCopyDto generate(@PathVariable long orderId) {
        return orderMarketingCopyService.generate(orderId);
    }

    @PostMapping("/zip")
    @Operation(summary = "将所选订单的三类文案打包为 ZIP 下载")
    public ResponseEntity<byte[]> zip(@Valid @RequestBody MarketingCopyZipRequest body) {
        return orderMarketingCopyService.zipExport(body.getOrderIds());
    }
}
