package com.jewelry.system.repository;

import com.jewelry.system.entity.OrderEvent;
import com.jewelry.system.enums.OrderEventType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrderEventRepository extends JpaRepository<OrderEvent, Long> {

    List<OrderEvent> findByOrderIdOrderByIdAsc(Long orderId);

    List<OrderEvent> findByOrderIdOrderByIdDesc(Long orderId);

    Optional<OrderEvent> findFirstByOrderIdAndEventTypeOrderByIdAsc(Long orderId, OrderEventType eventType);

    List<OrderEvent> findByOrderIdAndEventTypeInOrderByIdDesc(Long orderId, List<OrderEventType> types);
}
