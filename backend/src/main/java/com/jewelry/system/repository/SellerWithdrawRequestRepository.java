package com.jewelry.system.repository;

import com.jewelry.system.entity.SellerWithdrawRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SellerWithdrawRequestRepository extends JpaRepository<SellerWithdrawRequest, Long> {
    List<SellerWithdrawRequest> findByAccountIdOrderByCreatedAtDesc(Long accountId);
}
