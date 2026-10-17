package com.jewelry.system.repository;

import com.jewelry.system.entity.SellerWalletTxn;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SellerWalletTxnRepository extends JpaRepository<SellerWalletTxn, Long> {
    List<SellerWalletTxn> findByAccountIdOrderByCreatedAtDesc(Long accountId);

    Optional<SellerWalletTxn> findFirstByOrderIdAndType(Long orderId, String type);
}
