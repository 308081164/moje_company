package com.jewelry.system.repository;

import com.jewelry.system.entity.OrderPiece;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrderPieceRepository extends JpaRepository<OrderPiece, Long> {

    List<OrderPiece> findByOrderIdOrderBySeqAsc(Long orderId);

    Optional<OrderPiece> findByOrderIdAndSeq(Long orderId, int seq);

    int countByOrderId(Long orderId);

    boolean existsByIdAndOrderId(Long id, Long orderId);
}
