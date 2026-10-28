package com.jewelry.system.repository;

import com.jewelry.system.entity.OrderShipment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface OrderShipmentRepository extends JpaRepository<OrderShipment, Long>, JpaSpecificationExecutor<OrderShipment> {
    Optional<OrderShipment> findByOrderId(Long orderId);

    @Query("select s.orderId from OrderShipment s where s.orderId in :orderIds")
    List<Long> findOrderIdsIn(@Param("orderIds") Collection<Long> orderIds);
}
