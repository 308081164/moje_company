package com.jewelry.system.repository;

import com.jewelry.system.entity.SellerWallet;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SellerWalletRepository extends JpaRepository<SellerWallet, Long> {
    Optional<SellerWallet> findByAccountId(Long accountId);
}
