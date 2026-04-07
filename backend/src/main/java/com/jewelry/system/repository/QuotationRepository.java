package com.jewelry.system.repository;

import com.jewelry.system.entity.Quotation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface QuotationRepository extends JpaRepository<Quotation, Long> {

    Optional<Quotation> findByOrderId(Long orderId);
}
