package com.jewelry.system.repository;

import com.jewelry.system.entity.StorefrontListing;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StorefrontListingRepository extends JpaRepository<StorefrontListing, Long> {

    Optional<StorefrontListing> findBySourceOrderId(Long sourceOrderId);

    List<StorefrontListing> findByStatusOrderByUpdatedAtDesc(String status);

    List<StorefrontListing> findBySellerAccountIdOrderByUpdatedAtDesc(Long sellerAccountId);
}
