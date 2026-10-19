package com.jewelry.system.controller;

import com.jewelry.system.dto.storefront.*;
import com.jewelry.system.service.StorefrontService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/portal/c/storefront")
@RequiredArgsConstructor
@Tag(name = "C端寄售", description = "一键上架、购买、卖家后台与提现")
public class PortalStorefrontController {

    private final StorefrontService storefrontService;

    @GetMapping("/fee-guide")
    @Operation(summary = "代工与代邮参考价格区间")
    public StorefrontFeeGuideDto feeGuide() {
        return storefrontService.feeGuide();
    }

    @PostMapping("/publish")
    @Operation(summary = "将已完成设计/打样的订单一键发布到独立站")
    public StorefrontListingDto publish(@RequestBody StorefrontPublishRequest req) {
        return storefrontService.publish(req);
    }

    @PostMapping("/listings/{id}/pause")
    @Operation(summary = "下架自己的寄售商品")
    public StorefrontListingDto pause(@PathVariable long id) {
        return storefrontService.pause(id);
    }

    @PostMapping("/listings/{id}/republish")
    @Operation(summary = "重新上架自己的寄售商品")
    public StorefrontListingDto republish(@PathVariable long id) {
        return storefrontService.republish(id);
    }

    @GetMapping("/seller/listings")
    @Operation(summary = "卖家后台：我的全部寄售商品")
    public java.util.List<StorefrontListingDto> sellerListings() {
        return storefrontService.sellerListings();
    }

    @PatchMapping("/seller/listings/{id}")
    @Operation(summary = "卖家编辑自己的寄售商品（标题/描述/售价/封面图）")
    public StorefrontListingDto updateListing(@PathVariable long id, @RequestBody StorefrontListingUpdateRequest req) {
        return storefrontService.updateListing(id, req);
    }

    @PostMapping("/listings/{id}/purchase")
    @Operation(summary = "购买寄售商品（模拟全额支付）")
    public StorefrontPurchaseResponse purchase(@PathVariable long id, @RequestBody(required = false) StorefrontPurchaseRequest req) {
        return storefrontService.purchase(id, req);
    }

    @GetMapping("/seller")
    @Operation(summary = "卖家后台：销量、钱包与可提现余额")
    public SellerDashboardDto seller() {
        return storefrontService.sellerDashboard();
    }

    @PostMapping("/seller/withdraw")
    @Operation(summary = "提现可提现余额（模拟即时到账）")
    public ResponseEntity<SellerWithdrawDto> withdraw(@RequestBody SellerWithdrawCreateRequest req) {
        return ResponseEntity.ok(storefrontService.withdraw(req != null ? req.getAmount() : null));
    }
}
