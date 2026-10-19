package com.jewelry.system.service;

import com.jewelry.system.dto.referral.ReferralCodeDto;
import com.jewelry.system.dto.referral.ReferralDashboardDto;
import com.jewelry.system.dto.referral.ReferralWithdrawDto;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.ReferralBinding;
import com.jewelry.system.entity.ReferralCode;
import com.jewelry.system.entity.ReferralWallet;
import com.jewelry.system.entity.ReferralWalletTxn;
import com.jewelry.system.entity.ReferralWithdrawRequest;
import com.jewelry.system.enums.OrderSource;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.ReferralBindingRepository;
import com.jewelry.system.repository.ReferralCodeRepository;
import com.jewelry.system.repository.ReferralWalletRepository;
import com.jewelry.system.repository.ReferralWalletTxnRepository;
import com.jewelry.system.repository.ReferralWithdrawRequestRepository;
import com.jewelry.system.security.AccountKind;
import com.jewelry.system.security.SecurityUserPrincipal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReferralServiceTest {

    @Mock ReferralCodeRepository codeRepository;
    @Mock ReferralBindingRepository bindingRepository;
    @Mock ReferralWalletRepository walletRepository;
    @Mock ReferralWalletTxnRepository txnRepository;
    @Mock ReferralWithdrawRequestRepository withdrawRepository;
    @Mock OrderRepository orderRepository;

    @InjectMocks
    ReferralService referralService;

    @BeforeEach
    void loginAsReferrer() {
        SecurityUserPrincipal principal = new SecurityUserPrincipal(7L, "referrer@example.com", "C_PORTAL", AccountKind.C_PORTAL_CUSTOMER);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private ReferralCode codeOf(long accountId, String code) {
        ReferralCode rc = new ReferralCode();
        rc.setId(100L);
        rc.setAccountId(accountId);
        rc.setCode(code);
        rc.setStatus("ACTIVE");
        return rc;
    }

    private Order order(long id, String number) {
        Order o = new Order();
        o.setId(id);
        o.setOrderNumber(number);
        o.setSource(OrderSource.C2C);
        o.setStatus(OrderStatus.PRODUCING);
        return o;
    }

    private ReferralWallet walletWith(String available, String pending) {
        ReferralWallet w = new ReferralWallet();
        w.setAccountId(7L);
        w.setAvailableBalance(new BigDecimal(available));
        w.setPendingBalance(new BigDecimal(pending));
        w.setTotalEarned(BigDecimal.ZERO);
        w.setTotalWithdrawn(BigDecimal.ZERO);
        return w;
    }

    // ---------- 推广码生成 ----------

    @Test
    void myCode_createsEightCharAlphanumericCodeOnce() {
        when(codeRepository.findByAccountId(7L)).thenReturn(Optional.empty());
        when(codeRepository.existsByCode(any())).thenReturn(false);
        when(codeRepository.save(any(ReferralCode.class))).thenAnswer(inv -> inv.getArgument(0));

        ReferralCodeDto dto = referralService.myCode();

        assertThat(dto.getCode()).matches("[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}");
        assertThat(dto.getShareUrl()).endsWith("/?ref=" + dto.getCode());
        assertThat(dto.getQrCodeBase64()).startsWith("data:image/png;base64,");
        assertThat(dto.getCommissionRate()).isEqualByComparingTo("0.05");

        // 第二次访问复用同一码，不再生成
        ReferralCode existing = codeOf(7L, dto.getCode());
        when(codeRepository.findByAccountId(7L)).thenReturn(Optional.of(existing));
        ReferralCodeDto again = referralService.myCode();
        assertThat(again.getCode()).isEqualTo(dto.getCode());
        verify(codeRepository, org.mockito.Mockito.times(1)).save(any(ReferralCode.class));
    }

    // ---------- 绑定校验 ----------

    @Test
    void bindOnOrder_blankCodeSkips() {
        Order o = order(1L, "JZ001");
        assertThat(referralService.bindOnOrder(9L, null, o, new BigDecimal("49"))).isNull();
        assertThat(referralService.bindOnOrder(9L, "  ", o, new BigDecimal("49"))).isNull();
        verify(bindingRepository, never()).save(any());
    }

    @Test
    void bindOnOrder_computesFivePercentCommission() {
        when(codeRepository.findByCode("ABC23456")).thenReturn(Optional.of(codeOf(7L, "ABC23456")));
        when(bindingRepository.findByOrderId(1L)).thenReturn(Optional.empty());
        when(bindingRepository.save(any(ReferralBinding.class))).thenAnswer(inv -> {
            ReferralBinding b = inv.getArgument(0);
            b.setId(55L);
            return b;
        });
        ReferralWallet w = walletWith("0", "0");
        when(walletRepository.findByAccountId(7L)).thenReturn(Optional.of(w));

        Order o = order(1L, "JZ002");
        ReferralBinding b = referralService.bindOnOrder(9L, "abc23456", o, new BigDecimal("49.00"));

        assertThat(b.getReferrerAccountId()).isEqualTo(7L);
        assertThat(b.getBuyerAccountId()).isEqualTo(9L);
        assertThat(b.getOrderAmount()).isEqualByComparingTo("49.00");
        assertThat(b.getCommissionRate()).isEqualByComparingTo("0.05");
        // 49 × 5% = 2.45
        assertThat(b.getCommissionAmount()).isEqualByComparingTo("2.45");
        assertThat(b.getStatus()).isEqualTo("PENDING");
        // 待结算进入推广人钱包
        assertThat(w.getPendingBalance()).isEqualByComparingTo("2.45");
        ArgumentCaptor<ReferralWalletTxn> txn = ArgumentCaptor.forClass(ReferralWalletTxn.class);
        verify(txnRepository).save(txn.capture());
        assertThat(txn.getValue().getType()).isEqualTo("HOLD");
        assertThat(txn.getValue().getAmount()).isEqualByComparingTo("2.45");
    }

    @Test
    void bindOnOrder_rejectsUnknownCode() {
        when(codeRepository.findByCode("NOPE9999")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> referralService.bindOnOrder(9L, "NOPE9999", order(1L, "JZ003"), new BigDecimal("49")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(e.getReason()).contains("推广码无效");
                });
        verify(bindingRepository, never()).save(any());
    }

    @Test
    void bindOnOrder_rejectsSelfCode() {
        when(codeRepository.findByCode("SELF2222")).thenReturn(Optional.of(codeOf(9L, "SELF2222")));

        assertThatThrownBy(() -> referralService.bindOnOrder(9L, "SELF2222", order(1L, "JZ004"), new BigDecimal("49")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(e.getReason()).contains("自己的推广码");
                });
        verify(bindingRepository, never()).save(any());
    }

    @Test
    void bindOnOrder_duplicateOrderBindingIsIdempotent() {
        ReferralBinding existing = new ReferralBinding();
        existing.setId(55L);
        existing.setOrderId(1L);
        existing.setReferrerAccountId(7L);
        when(codeRepository.findByCode("ABC23456")).thenReturn(Optional.of(codeOf(7L, "ABC23456")));
        when(bindingRepository.findByOrderId(1L)).thenReturn(Optional.of(existing));

        ReferralBinding result = referralService.bindOnOrder(9L, "ABC23456", order(1L, "JZ005"), new BigDecimal("49"));

        assertThat(result).isSameAs(existing);
        verify(bindingRepository, never()).save(any());
        verify(txnRepository, never()).save(any());
    }

    // ---------- 完成结算 ----------

    @Test
    void settleOnCompleted_movesPendingToAvailable() {
        ReferralBinding b = new ReferralBinding();
        b.setId(55L);
        b.setOrderId(1L);
        b.setReferrerAccountId(7L);
        b.setCommissionAmount(new BigDecimal("2.45"));
        b.setStatus("PENDING");
        when(bindingRepository.findByOrderId(1L)).thenReturn(Optional.of(b));
        when(txnRepository.findFirstByOrderIdAndType(1L, "SETTLE")).thenReturn(Optional.empty());
        ReferralWallet w = walletWith("0.00", "2.45");
        when(walletRepository.findByAccountId(7L)).thenReturn(Optional.of(w));
        when(orderRepository.findById(1L)).thenReturn(Optional.of(order(1L, "JZ006")));

        referralService.settleOnCompleted(1L);

        assertThat(b.getStatus()).isEqualTo("SETTLED");
        assertThat(b.getSettledAt()).isNotNull();
        assertThat(w.getPendingBalance()).isEqualByComparingTo("0.00");
        assertThat(w.getAvailableBalance()).isEqualByComparingTo("2.45");
        assertThat(w.getTotalEarned()).isEqualByComparingTo("2.45");
        ArgumentCaptor<ReferralWalletTxn> txn = ArgumentCaptor.forClass(ReferralWalletTxn.class);
        verify(txnRepository).save(txn.capture());
        assertThat(txn.getValue().getType()).isEqualTo("SETTLE");
    }

    @Test
    void settleOnCompleted_isIdempotentAndIgnoresUnboundOrders() {
        // 无绑定订单：直接跳过
        when(bindingRepository.findByOrderId(2L)).thenReturn(Optional.empty());
        referralService.settleOnCompleted(2L);
        verify(walletRepository, never()).save(any());

        // 已结算绑定：不重复入账
        ReferralBinding settled = new ReferralBinding();
        settled.setOrderId(3L);
        settled.setStatus("SETTLED");
        when(bindingRepository.findByOrderId(3L)).thenReturn(Optional.of(settled));
        referralService.settleOnCompleted(3L);
        verify(walletRepository, never()).save(any());
        verify(txnRepository, never()).save(any());
    }

    // ---------- 提现 ----------

    @Test
    void withdraw_deductsAvailableAndPaysOut() {
        ReferralWallet w = walletWith("10.00", "4.00");
        w.setTotalEarned(new BigDecimal("10.00"));
        when(walletRepository.findByAccountId(7L)).thenReturn(Optional.of(w));
        when(withdrawRepository.save(any(ReferralWithdrawRequest.class))).thenAnswer(inv -> {
            ReferralWithdrawRequest r = inv.getArgument(0);
            r.setId(88L);
            return r;
        });

        ReferralWithdrawDto dto = referralService.withdraw(new BigDecimal("6.00"));

        assertThat(dto.getStatus()).isEqualTo("PAID");
        assertThat(dto.getAmount()).isEqualByComparingTo("6.00");
        assertThat(w.getAvailableBalance()).isEqualByComparingTo("4.00");
        assertThat(w.getTotalWithdrawn()).isEqualByComparingTo("6.00");
        assertThat(w.getPendingBalance()).isEqualByComparingTo("4.00");
        ArgumentCaptor<ReferralWalletTxn> txn = ArgumentCaptor.forClass(ReferralWalletTxn.class);
        verify(txnRepository).save(txn.capture());
        assertThat(txn.getValue().getType()).isEqualTo("WITHDRAW");
        assertThat(txn.getValue().getAmount()).isEqualByComparingTo("-6.00");
    }

    @Test
    void withdraw_rejectsInsufficientAndNonPositive() {
        ReferralWallet w = walletWith("5.00", "0.00");
        when(walletRepository.findByAccountId(7L)).thenReturn(Optional.of(w));

        assertThatThrownBy(() -> referralService.withdraw(new BigDecimal("5.01")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(e.getReason()).contains("余额不足");
                });
        assertThatThrownBy(() -> referralService.withdraw(BigDecimal.ZERO))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        assertThatThrownBy(() -> referralService.withdraw(null))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(withdrawRepository, never()).save(any());
    }

    // ---------- 看板 ----------

    @Test
    void dashboard_aggregatesWalletStatsAndLists() {
        when(codeRepository.findByAccountId(7L)).thenReturn(Optional.of(codeOf(7L, "ABC23456")));
        ReferralWallet w = walletWith("7.35", "2.45");
        w.setTotalEarned(new BigDecimal("9.80"));
        w.setTotalWithdrawn(new BigDecimal("2.45"));
        when(walletRepository.findByAccountId(7L)).thenReturn(Optional.of(w));

        ReferralBinding b1 = new ReferralBinding();
        b1.setId(1L);
        b1.setOrderId(11L);
        b1.setBuyerAccountId(21L);
        b1.setOrderAmount(new BigDecimal("99.00"));
        b1.setCommissionAmount(new BigDecimal("4.95"));
        b1.setStatus("SETTLED");
        ReferralBinding b2 = new ReferralBinding();
        b2.setId(2L);
        b2.setOrderId(12L);
        b2.setBuyerAccountId(22L);
        b2.setOrderAmount(new BigDecimal("49.00"));
        b2.setCommissionAmount(new BigDecimal("2.45"));
        b2.setStatus("PENDING");
        when(bindingRepository.findByReferrerAccountIdOrderByCreatedAtDesc(7L)).thenReturn(List.of(b1, b2));
        when(orderRepository.findById(11L)).thenReturn(Optional.of(order(11L, "JZ011")));
        when(orderRepository.findById(12L)).thenReturn(Optional.of(order(12L, "JZ012")));
        when(txnRepository.findByAccountIdOrderByCreatedAtDesc(7L)).thenReturn(List.of());
        when(withdrawRepository.findByAccountIdOrderByCreatedAtDesc(7L)).thenReturn(List.of());

        ReferralDashboardDto dto = referralService.dashboard();

        assertThat(dto.getCode()).isEqualTo("ABC23456");
        assertThat(dto.getAvailableBalance()).isEqualByComparingTo("7.35");
        assertThat(dto.getPendingBalance()).isEqualByComparingTo("2.45");
        assertThat(dto.getTotalEarned()).isEqualByComparingTo("9.80");
        assertThat(dto.getTotalWithdrawn()).isEqualByComparingTo("2.45");
        assertThat(dto.getBoundOrderCount()).isEqualTo(2);
        assertThat(dto.getSettledOrderCount()).isEqualTo(1);
        assertThat(dto.getBoundBuyerCount()).isEqualTo(2);
        assertThat(dto.getBindings()).hasSize(2);
        assertThat(dto.getBindings().get(0).getOrderNumber()).isEqualTo("JZ011");
        assertThat(dto.getShareUrl()).endsWith("/?ref=ABC23456");
    }
}
