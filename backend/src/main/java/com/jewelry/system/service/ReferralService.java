package com.jewelry.system.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import com.jewelry.system.dto.referral.*;
import com.jewelry.system.entity.*;
import com.jewelry.system.repository.*;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * C 端个人推广码：专属短码、下单绑定、订单完成 5% 佣金结算与模拟提现。
 * 与寄售钱包（seller_wallet*）同构但语义独立，互不干扰。
 */
@Service
@RequiredArgsConstructor
public class ReferralService {

    /** 统一佣金比例 5%（不设推广等级） */
    public static final BigDecimal COMMISSION_RATE = new BigDecimal("0.05");

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
    /** 去除易混淆字符（0/O、1/I/L）的短码字母表 */
    private static final String CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    private static final int CODE_LENGTH = 8;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final ReferralCodeRepository codeRepository;
    private final ReferralBindingRepository bindingRepository;
    private final ReferralWalletRepository walletRepository;
    private final ReferralWalletTxnRepository txnRepository;
    private final ReferralWithdrawRequestRepository withdrawRepository;
    private final OrderRepository orderRepository;

    /** C 端门户根地址（生产为 http://host:8853），用于拼接带 ref 参数的分享链接 */
    @Value("${app.customer-order.public-frontend-base-url:}")
    private String customerFrontendBaseUrl;

    @Value("${app.portal.base-url:}")
    private String portalBaseUrl;

    // ---------- 推广码 ----------

    @Transactional
    public ReferralCode requireCode(Long accountId) {
        return codeRepository.findByAccountId(accountId).orElseGet(() -> createCode(accountId));
    }

    private ReferralCode createCode(Long accountId) {
        ReferralCode rc = new ReferralCode();
        rc.setAccountId(accountId);
        rc.setStatus("ACTIVE");
        // 冲突时重试（8 位短码空间足够大，冲突概率极低）
        for (int i = 0; i < 20; i++) {
            String candidate = randomCode();
            if (!codeRepository.existsByCode(candidate)) {
                rc.setCode(candidate);
                return codeRepository.save(rc);
            }
        }
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "推广码生成失败，请重试");
    }

    private static String randomCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
        }
        return sb.toString();
    }

    @Transactional
    public ReferralCodeDto myCode() {
        Long accountId = requireCustomer();
        ReferralCode rc = requireCode(accountId);
        String shareUrl = buildShareUrl(rc.getCode());
        return ReferralCodeDto.builder()
                .code(rc.getCode())
                .shareUrl(shareUrl)
                .qrCodeBase64(generateQrcodeBase64(shareUrl))
                .commissionRate(COMMISSION_RATE)
                .build();
    }

    /** 带 ref 参数的 C 端首页链接，如 https://host:8853/?ref=CODE */
    private String buildShareUrl(String code) {
        String base = StringUtils.hasText(customerFrontendBaseUrl)
                ? customerFrontendBaseUrl.trim()
                : (portalBaseUrl == null ? "" : portalBaseUrl.trim());
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base + "/?ref=" + code;
    }

    // ---------- 下单绑定 ----------

    /**
     * 下单时绑定推广码（可空）。校验：码存在且有效、非本人；同订单重复绑定幂等跳过。
     * 佣金基数：定制单定金 / 商城单售价，统一 5%。
     *
     * @return 新建或已存在的绑定；未填写推广码时返回 null
     */
    @Transactional
    public ReferralBinding bindOnOrder(Long buyerId, String rawCode, Order order, BigDecimal baseAmount) {
        if (!StringUtils.hasText(rawCode)) {
            return null;
        }
        String code = rawCode.trim().toUpperCase();
        ReferralCode rc = codeRepository.findByCode(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "推广码无效"));
        if (!"ACTIVE".equals(rc.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "推广码已停用");
        }
        if (rc.getAccountId().equals(buyerId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不能使用自己的推广码");
        }
        var existing = bindingRepository.findByOrderId(order.getId());
        if (existing.isPresent()) {
            return existing.get();
        }

        BigDecimal base = baseAmount == null ? BigDecimal.ZERO : baseAmount.setScale(2, RoundingMode.HALF_UP);
        BigDecimal commission = base.multiply(COMMISSION_RATE).setScale(2, RoundingMode.HALF_UP);

        ReferralBinding binding = new ReferralBinding();
        binding.setReferralCodeId(rc.getId());
        binding.setReferrerAccountId(rc.getAccountId());
        binding.setBuyerAccountId(buyerId);
        binding.setOrderId(order.getId());
        binding.setOrderAmount(base);
        binding.setCommissionRate(COMMISSION_RATE);
        binding.setCommissionAmount(commission);
        binding.setStatus("PENDING");
        bindingRepository.save(binding);

        if (commission.compareTo(BigDecimal.ZERO) > 0) {
            ReferralWallet w = requireWallet(rc.getAccountId());
            w.setPendingBalance(nz(w.getPendingBalance()).add(commission));
            walletRepository.save(w);
            saveTxn(rc.getAccountId(), order.getId(), binding.getId(), "HOLD", commission,
                    "推广订单待结算：" + order.getOrderNumber());
        }
        return binding;
    }

    // ---------- 订单完成结算 ----------

    /** 订单流转到 COMPLETED 时调用：PENDING 绑定结算为可提现余额（幂等）。 */
    @Transactional
    public void settleOnCompleted(long orderId) {
        ReferralBinding binding = bindingRepository.findByOrderId(orderId).orElse(null);
        if (binding == null || !"PENDING".equals(binding.getStatus())) {
            return;
        }
        if (txnRepository.findFirstByOrderIdAndType(orderId, "SETTLE").isPresent()) {
            return;
        }
        BigDecimal amount = nz(binding.getCommissionAmount());
        binding.setStatus("SETTLED");
        binding.setSettledAt(LocalDateTime.now());
        bindingRepository.save(binding);

        if (amount.compareTo(BigDecimal.ZERO) > 0) {
            ReferralWallet w = requireWallet(binding.getReferrerAccountId());
            BigDecimal pending = nz(w.getPendingBalance());
            w.setPendingBalance(pending.compareTo(amount) >= 0 ? pending.subtract(amount) : BigDecimal.ZERO);
            w.setAvailableBalance(nz(w.getAvailableBalance()).add(amount));
            w.setTotalEarned(nz(w.getTotalEarned()).add(amount));
            walletRepository.save(w);
            Order order = orderRepository.findById(orderId).orElse(null);
            saveTxn(binding.getReferrerAccountId(), orderId, binding.getId(), "SETTLE", amount,
                    "订单完成，佣金可提现：" + (order != null ? order.getOrderNumber() : orderId));
        }
    }

    // ---------- 钱包与提现 ----------

    @Transactional
    public ReferralWallet requireWallet(Long accountId) {
        return walletRepository.findByAccountId(accountId).orElseGet(() -> {
            ReferralWallet w = new ReferralWallet();
            w.setAccountId(accountId);
            w.setAvailableBalance(BigDecimal.ZERO);
            w.setPendingBalance(BigDecimal.ZERO);
            w.setTotalEarned(BigDecimal.ZERO);
            w.setTotalWithdrawn(BigDecimal.ZERO);
            return walletRepository.save(w);
        });
    }

    @Transactional
    public ReferralWithdrawDto withdraw(BigDecimal amount) {
        Long accountId = requireCustomer();
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "提现金额必须大于 0");
        }
        ReferralWallet w = requireWallet(accountId);
        if (nz(w.getAvailableBalance()).compareTo(amount) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "可提现余额不足");
        }
        w.setAvailableBalance(w.getAvailableBalance().subtract(amount));
        w.setTotalWithdrawn(nz(w.getTotalWithdrawn()).add(amount));
        walletRepository.save(w);

        ReferralWithdrawRequest req = new ReferralWithdrawRequest();
        req.setAccountId(accountId);
        req.setAmount(amount);
        req.setStatus("PAID");
        req.setRemark("模拟提现已到账");
        withdrawRepository.save(req);

        saveTxn(accountId, null, null, "WITHDRAW", amount.negate(), "提现（模拟即时到账）");
        return toWithdrawDto(req);
    }

    // ---------- 推广看板 ----------

    @Transactional
    public ReferralDashboardDto dashboard() {
        Long accountId = requireCustomer();
        ReferralCode rc = requireCode(accountId);
        String shareUrl = buildShareUrl(rc.getCode());
        ReferralWallet wallet = requireWallet(accountId);

        List<ReferralBinding> bindings = bindingRepository.findByReferrerAccountIdOrderByCreatedAtDesc(accountId);
        List<ReferralBindingDto> bindingDtos = bindings.stream().map(b -> {
            Order order = orderRepository.findById(b.getOrderId()).orElse(null);
            return ReferralBindingDto.builder()
                    .bindingId(b.getId())
                    .orderId(b.getOrderId())
                    .orderNumber(order != null ? order.getOrderNumber() : null)
                    .orderStatus(order != null && order.getStatus() != null ? order.getStatus().name() : null)
                    .orderStatusLabel(order != null && order.getStatus() != null ? order.getStatus().getDescription() : null)
                    .orderSource(order != null && order.getSource() != null ? order.getSource().name() : null)
                    .orderAmount(b.getOrderAmount())
                    .commissionAmount(b.getCommissionAmount())
                    .status(b.getStatus())
                    .createdAt(b.getCreatedAt() != null ? ISO.format(b.getCreatedAt()) : null)
                    .settledAt(b.getSettledAt() != null ? ISO.format(b.getSettledAt()) : null)
                    .build();
        }).toList();

        List<ReferralTxnDto> txns = txnRepository.findByAccountIdOrderByCreatedAtDesc(accountId).stream()
                .map(t -> ReferralTxnDto.builder()
                        .id(t.getId())
                        .orderId(t.getOrderId())
                        .type(t.getType())
                        .amount(t.getAmount())
                        .remark(t.getRemark())
                        .createdAt(t.getCreatedAt() != null ? ISO.format(t.getCreatedAt()) : null)
                        .build())
                .toList();

        List<ReferralWithdrawDto> withdrawals = withdrawRepository.findByAccountIdOrderByCreatedAtDesc(accountId).stream()
                .map(this::toWithdrawDto)
                .toList();

        long buyerCount = bindings.stream().map(ReferralBinding::getBuyerAccountId).distinct().count();
        return ReferralDashboardDto.builder()
                .code(rc.getCode())
                .shareUrl(shareUrl)
                .qrCodeBase64(generateQrcodeBase64(shareUrl))
                .commissionRate(COMMISSION_RATE)
                .availableBalance(nz(wallet.getAvailableBalance()))
                .pendingBalance(nz(wallet.getPendingBalance()))
                .totalEarned(nz(wallet.getTotalEarned()))
                .totalWithdrawn(nz(wallet.getTotalWithdrawn()))
                .boundOrderCount(bindings.size())
                .settledOrderCount(bindings.stream().filter(b -> "SETTLED".equals(b.getStatus())).count())
                .boundBuyerCount(buyerCount)
                .bindings(bindingDtos)
                .txns(txns)
                .withdrawals(withdrawals)
                .build();
    }

    // ---------- internals ----------

    private ReferralWithdrawDto toWithdrawDto(ReferralWithdrawRequest req) {
        return ReferralWithdrawDto.builder()
                .id(req.getId())
                .amount(req.getAmount())
                .status(req.getStatus())
                .remark(req.getRemark())
                .createdAt(req.getCreatedAt() != null ? ISO.format(req.getCreatedAt()) : null)
                .build();
    }

    private void saveTxn(Long accountId, Long orderId, Long bindingId, String type, BigDecimal amount, String remark) {
        ReferralWalletTxn t = new ReferralWalletTxn();
        t.setAccountId(accountId);
        t.setOrderId(orderId);
        t.setBindingId(bindingId);
        t.setType(type);
        t.setAmount(amount);
        t.setRemark(remark);
        txnRepository.save(t);
    }

    private String generateQrcodeBase64(String content) {
        try {
            Map<EncodeHintType, Object> hints = new HashMap<>();
            hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");
            hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M);
            hints.put(EncodeHintType.MARGIN, 1);

            QRCodeWriter qrCodeWriter = new QRCodeWriter();
            BitMatrix bitMatrix = qrCodeWriter.encode(content, BarcodeFormat.QR_CODE, 320, 320, hints);

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(bitMatrix, "PNG", outputStream);

            return "data:image/png;base64," + Base64.getEncoder().encodeToString(outputStream.toByteArray());
        } catch (WriterException | IOException e) {
            return null;
        }
    }

    private Long requireCustomer() {
        return SecurityUtils.currentPortalCustomerId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录"));
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
