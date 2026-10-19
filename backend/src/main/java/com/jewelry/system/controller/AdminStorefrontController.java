package com.jewelry.system.controller;

import com.jewelry.system.dto.admin.AdminStorefrontListingDto;
import com.jewelry.system.dto.admin.AdminStorefrontOrderDto;
import com.jewelry.system.dto.admin.AdminStorefrontSellerDto;
import com.jewelry.system.dto.admin.AdminStorefrontWithdrawalDto;
import com.jewelry.system.dto.storefront.StorefrontListingUpdateRequest;
import com.jewelry.system.service.AdminStorefrontService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 员工端管理员对独立站商城（寄售 marketplace）的管理接口。
 * 鉴权：staff JWT + ADMIN 角色（服务内校验，归属无关）。
 */
@RestController
@RequestMapping("/admin/storefront")
@RequiredArgsConstructor
@Tag(name = "管理员-独立站商城", description = "商品管理、商城订单、卖家概览与提现记录")
public class AdminStorefrontController {

    private final AdminStorefrontService adminStorefrontService;

    // ---------- 商品管理 ----------

    @GetMapping("/listings")
    @Operation(summary = "全量寄售商品列表（可按状态/关键词筛选）")
    public List<AdminStorefrontListingDto> listings(@RequestParam(required = false) String status,
                                                    @RequestParam(required = false) String keyword) {
        return adminStorefrontService.listings(status, keyword);
    }

    @PatchMapping("/listings/{id}")
    @Operation(summary = "管理员编辑任意寄售商品（标题/描述/售价/封面图）")
    public AdminStorefrontListingDto updateListing(@PathVariable long id,
                                                   @RequestBody StorefrontListingUpdateRequest req) {
        return adminStorefrontService.updateListing(id, req);
    }

    @PostMapping("/listings/{id}/pause")
    @Operation(summary = "管理员下架任意寄售商品")
    public AdminStorefrontListingDto pause(@PathVariable long id) {
        return adminStorefrontService.pause(id);
    }

    @PostMapping("/listings/{id}/republish")
    @Operation(summary = "管理员重新上架任意寄售商品")
    public AdminStorefrontListingDto republish(@PathVariable long id) {
        return adminStorefrontService.republish(id);
    }

    // ---------- 商城订单 ----------

    @GetMapping("/orders")
    @Operation(summary = "独立站商城订单（source=MARKETPLACE，分页+筛选）")
    public Page<AdminStorefrontOrderDto> orders(Pageable pageable,
                                                @RequestParam(required = false) String status,
                                                @RequestParam(required = false) Long sellerId,
                                                @RequestParam(required = false) String keyword) {
        return adminStorefrontService.orders(pageable, status, sellerId, keyword);
    }

    // ---------- 卖家概览 / 提现记录 ----------

    @GetMapping("/sellers")
    @Operation(summary = "各卖家上架数/销量/钱包聚合概览")
    public List<AdminStorefrontSellerDto> sellers() {
        return adminStorefrontService.sellers();
    }

    @GetMapping("/withdrawals")
    @Operation(summary = "卖家提现申请记录（模拟即时到账，只读）")
    public List<AdminStorefrontWithdrawalDto> withdrawals() {
        return adminStorefrontService.withdrawals();
    }
}
