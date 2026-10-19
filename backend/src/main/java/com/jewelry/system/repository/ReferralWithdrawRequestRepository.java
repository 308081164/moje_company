package com.jewelry.system.repository;

import com.jewelry.system.entity.ReferralWithdrawRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReferralWithdrawRequestRepository extends JpaRepository<ReferralWithdrawRequest, Long> {
    List<ReferralWithdrawRequest> findByAccountIdOrderByCreatedAtDesc(Long accountId);
}
