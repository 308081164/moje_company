package com.jewelry.system.repository;

import com.jewelry.system.entity.OrderModelingArchive;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OrderModelingArchiveRepository extends JpaRepository<OrderModelingArchive, Long> {

    Optional<OrderModelingArchive> findByOrderId(Long orderId);
}
