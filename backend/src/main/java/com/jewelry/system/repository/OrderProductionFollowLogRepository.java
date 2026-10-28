package com.jewelry.system.repository;

import com.jewelry.system.entity.OrderProductionFollowLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface OrderProductionFollowLogRepository extends JpaRepository<OrderProductionFollowLog, Long> {
    List<OrderProductionFollowLog> findByOrderIdOrderByIdAsc(Long orderId);

    boolean existsByOrderIdAndPieceIdAndProcessCode(Long orderId, Long pieceId, String processCode);

    @Query("SELECT l.pieceId FROM OrderProductionFollowLog l WHERE l.orderId = :orderId AND l.processCode = :processCode")
    List<Long> findPieceIdsByOrderIdAndProcessCode(@Param("orderId") Long orderId, @Param("processCode") String processCode);

    List<OrderProductionFollowLog> findTop40ByAuthorUserIdOrderByIdDesc(Long authorUserId);
}
