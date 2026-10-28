package com.jewelry.system.repository;

import com.jewelry.system.entity.OrderCustomerBrief;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OrderCustomerBriefRepository extends JpaRepository<OrderCustomerBrief, Long> {

    Optional<OrderCustomerBrief> findByOrderId(Long orderId);
}
