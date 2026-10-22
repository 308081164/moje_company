package com.jewelry.system.repository;

import com.jewelry.system.entity.OrderAiIntake;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OrderAiIntakeRepository extends JpaRepository<OrderAiIntake, Long> {

    Optional<OrderAiIntake> findByOrderId(Long orderId);

    Optional<OrderAiIntake> findByConversationIdAndStatus(Long conversationId, String status);

    Optional<OrderAiIntake> findByConversationId(Long conversationId);
}
