package com.jewelry.system.repository;

import com.jewelry.system.entity.ReferralBinding;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ReferralBindingRepository extends JpaRepository<ReferralBinding, Long> {
    Optional<ReferralBinding> findByOrderId(Long orderId);

    List<ReferralBinding> findByReferrerAccountIdOrderByCreatedAtDesc(Long referrerAccountId);

    long countByReferrerAccountId(Long referrerAccountId);

    long countByReferrerAccountIdAndStatus(Long referrerAccountId, String status);
}
