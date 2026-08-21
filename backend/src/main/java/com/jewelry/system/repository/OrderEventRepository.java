package com.jewelry.system.repository;

import com.jewelry.system.entity.OrderEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrderEventRepository extends JpaRepository<OrderEvent, Long> {

    List<OrderEvent> findByOrderIdOrderByIdAsc(Long orderId);

    List<OrderEvent> findByOrderIdOrderByIdDesc(Long orderId);
}
