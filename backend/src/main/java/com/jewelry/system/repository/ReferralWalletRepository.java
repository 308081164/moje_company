package com.jewelry.system.repository;

import com.jewelry.system.entity.ReferralWallet;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ReferralWalletRepository extends JpaRepository<ReferralWallet, Long> {
    Optional<ReferralWallet> findByAccountId(Long accountId);
}
