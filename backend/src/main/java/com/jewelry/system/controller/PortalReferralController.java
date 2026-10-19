package com.jewelry.system.controller;

import com.jewelry.system.dto.referral.ReferralCodeDto;
import com.jewelry.system.dto.referral.ReferralDashboardDto;
import com.jewelry.system.dto.referral.ReferralWithdrawCreateRequest;
import com.jewelry.system.dto.referral.ReferralWithdrawDto;
import com.jewelry.system.service.ReferralService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/portal/c/referral")
@RequiredArgsConstructor
@Tag(name = "C端个人推广", description = "专属推广码、5% 佣金钱包与模拟提现")
public class PortalReferralController {

    private final ReferralService referralService;

    @GetMapping("/code")
    @Operation(summary = "我的推广码（首次访问自动生成）：短码 + 分享链接 + 二维码")
    public ReferralCodeDto myCode() {
        return referralService.myCode();
    }

    @GetMapping("/dashboard")
    @Operation(summary = "推广看板：钱包三卡片、绑定订单、佣金明细与提现记录")
    public ReferralDashboardDto dashboard() {
        return referralService.dashboard();
    }

    @PostMapping("/withdraw")
    @Operation(summary = "佣金提现（模拟即时到账）")
    public ReferralWithdrawDto withdraw(@RequestBody ReferralWithdrawCreateRequest req) {
        return referralService.withdraw(req != null ? req.getAmount() : null);
    }
}
