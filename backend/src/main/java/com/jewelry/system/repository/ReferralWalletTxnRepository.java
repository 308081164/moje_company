package com.jewelry.system.repository;

import com.jewelry.system.entity.ReferralWalletTxn;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ReferralWalletTxnRepository extends JpaRepository<ReferralWalletTxn, Long> {
    Optional<ReferralWalletTxn> findFirstByOrderIdAndType(Long orderId, String type);

    List<ReferralWalletTxn> findByAccountIdOrderByCreatedAtDesc(Long accountId);
}
