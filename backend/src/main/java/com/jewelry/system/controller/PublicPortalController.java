package com.jewelry.system.controller;

import com.jewelry.system.dto.portal.PortalCategoryDetailPublicDto;
import com.jewelry.system.dto.portal.PortalHomePublicDto;
import com.jewelry.system.service.PortalPublicService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/public/portal")
@RequiredArgsConstructor
@Tag(name = "门户公开数据", description = "B 端门户网站读取，无需登录")
public class PublicPortalController {

    private final PortalPublicService portalPublicService;

    @GetMapping("/home")
    @Operation(summary = "门户首页聚合数据（站点字段、轮播、分类与橱窗预览）")
    public PortalHomePublicDto home() {
        return portalPublicService.home();
    }

    @GetMapping("/category/{slug}")
    @Operation(summary = "某珠宝分类下全部对外展示素材")
    public PortalCategoryDetailPublicDto category(@PathVariable String slug) {
        return portalPublicService.categoryDetail(slug);
    }
}
