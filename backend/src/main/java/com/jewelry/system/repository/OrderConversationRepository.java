package com.jewelry.system.repository;

import com.jewelry.system.entity.OrderConversation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OrderConversationRepository extends JpaRepository<OrderConversation, Long> {

    Optional<OrderConversation> findByOrderId(Long orderId);

    boolean existsByOrderId(Long orderId);
}
