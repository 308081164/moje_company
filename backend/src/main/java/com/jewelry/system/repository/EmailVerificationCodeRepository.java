package com.jewelry.system.repository;

import com.jewelry.system.entity.EmailVerificationCode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EmailVerificationCodeRepository extends JpaRepository<EmailVerificationCode, Long> {

    Optional<EmailVerificationCode> findTopByEmailAndPurposeOrderByIdDesc(String email, String purpose);
}
