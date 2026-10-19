package com.jewelry.system.repository;

import com.jewelry.system.entity.ReferralCode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ReferralCodeRepository extends JpaRepository<ReferralCode, Long> {
    Optional<ReferralCode> findByAccountId(Long accountId);

    Optional<ReferralCode> findByCode(String code);

    boolean existsByCode(String code);
}
