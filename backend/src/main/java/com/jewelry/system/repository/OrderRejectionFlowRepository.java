package com.jewelry.system.repository;

import com.jewelry.system.entity.OrderRejectionFlow;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRejectionFlowRepository extends JpaRepository<OrderRejectionFlow, Long> {
    
    Optional<OrderRejectionFlow> findByOrderIdAndRejectionType(Long orderId, String rejectionType);
    
    List<OrderRejectionFlow> findByOrderId(Long orderId);
    
    List<OrderRejectionFlow> findByCurrentStage(String currentStage);
    
    List<OrderRejectionFlow> findByRejectionType(String rejectionType);
}
