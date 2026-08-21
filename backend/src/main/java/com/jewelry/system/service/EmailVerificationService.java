package com.jewelry.system.service;

import com.jewelry.system.entity.EmailVerificationCode;
import com.jewelry.system.repository.EmailVerificationCodeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailVerificationService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int CODE_TTL_MINUTES = 5;
    private static final int RESEND_INTERVAL_SECONDS = 60;
    private static final int MAX_ATTEMPTS = 5;

    /** 测试/演示用固定验证码：输入该码可直接通过校验，无需真实收发邮件 */
    @Value("${app.auth.fixed-verification-code:123456}")
    private String fixedVerificationCode;

    private final EmailVerificationCodeRepository codeRepository;
    private final EmailNotificationService emailNotificationService;

    @Transactional
    public void sendCode(String email, String purpose) {
        String normalized = normalizeEmail(email);
        String purposeValue = StringUtils.hasText(purpose) ? purpose.trim().toUpperCase() : "LOGIN";

        codeRepository.findTopByEmailAndPurposeOrderByIdDesc(normalized, purposeValue)
                .filter(c -> c.getCreatedAt().isAfter(LocalDateTime.now().minusSeconds(RESEND_INTERVAL_SECONDS)))
                .ifPresent(c -> {
                    throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "发送过于频繁，请稍后再试");
                });

        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        EmailVerificationCode entity = new EmailVerificationCode();
        entity.setEmail(normalized);
        entity.setCode(code);
        entity.setPurpose(purposeValue);
        entity.setExpiresAt(LocalDateTime.now().plusMinutes(CODE_TTL_MINUTES));
        codeRepository.save(entity);

        // 邮件发送失败不阻塞流程：测试/演示环境未配置 SMTP 时仍可用固定验证码登录
        try {
            emailNotificationService.sendVerificationCode(normalized, code);
        } catch (Exception e) {
            log.warn("验证码邮件发送失败（不影响固定验证码登录）: {}", e.getMessage());
        }
    }

    @Transactional
    public void verifyAndConsume(String email, String code, String purpose) {
        String normalized = normalizeEmail(email);

        // 固定验证码：直接通过，无需真实验证码记录
        if (StringUtils.hasText(fixedVerificationCode) && fixedVerificationCode.equals(code)) {
            log.info("使用固定验证码登录: {}", normalized);
            return;
        }

        String purposeValue = StringUtils.hasText(purpose) ? purpose.trim().toUpperCase() : "LOGIN";

        EmailVerificationCode entity = codeRepository
                .findTopByEmailAndPurposeOrderByIdDesc(normalized, purposeValue)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "验证码不存在或已过期"));

        if (Boolean.TRUE.equals(entity.getConsumed())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "验证码已使用，请重新获取");
        }
        if (entity.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "验证码已过期，请重新获取");
        }
        if (entity.getAttemptCount() != null && entity.getAttemptCount() >= MAX_ATTEMPTS) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "尝试次数过多，请重新获取验证码");
        }
        if (!entity.getCode().equals(code)) {
            entity.setAttemptCount((entity.getAttemptCount() == null ? 0 : entity.getAttemptCount()) + 1);
            codeRepository.save(entity);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "验证码错误");
        }

        entity.setConsumed(true);
        codeRepository.save(entity);
    }

    private String normalizeEmail(String email) {
        if (!StringUtils.hasText(email) || !email.contains("@")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "邮箱格式不正确");
        }
        return email.trim().toLowerCase();
    }
}
