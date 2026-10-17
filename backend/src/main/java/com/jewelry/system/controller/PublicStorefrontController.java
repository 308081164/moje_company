package com.jewelry.system.controller;

import com.jewelry.system.dto.storefront.StorefrontFeeGuideDto;
import com.jewelry.system.dto.storefront.StorefrontListingDto;
import com.jewelry.system.service.StorefrontService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/public/storefront")
@RequiredArgsConstructor
@Tag(name = "C端独立站寄售公开", description = "商品浏览与代工/代邮参考价")
public class PublicStorefrontController {

    private final StorefrontService storefrontService;

    @GetMapping("/fee-guide")
    @Operation(summary = "代工与代邮参考价格区间")
    public StorefrontFeeGuideDto feeGuide() {
        return storefrontService.feeGuide();
    }

    @GetMapping("/listings")
    @Operation(summary = "已上架寄售商品列表")
    public List<StorefrontListingDto> listings() {
        return storefrontService.publicListings();
    }

    @GetMapping("/listings/{id}")
    @Operation(summary = "寄售商品详情")
    public StorefrontListingDto listing(@PathVariable long id) {
        return storefrontService.publicListing(id);
    }
}
