package com.jewelry.system.repository;

import com.jewelry.system.entity.OrderProductionFollowLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrderProductionFollowLogRepository extends JpaRepository<OrderProductionFollowLog, Long> {
    List<OrderProductionFollowLog> findByOrderIdOrderByIdAsc(Long orderId);
}
