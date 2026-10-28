package com.jewelry.system.repository;

import com.jewelry.system.entity.ModelingInfo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ModelingInfoRepository extends JpaRepository<ModelingInfo, Long> {

    Optional<ModelingInfo> findFirstByOrderIdOrderByIdAsc(Long orderId);

    default Optional<ModelingInfo> findByOrderId(Long orderId) {
        return findFirstByOrderIdOrderByIdAsc(orderId);
    }

    Optional<ModelingInfo> findByPieceId(Long pieceId);

    List<ModelingInfo> findAllByOrderId(Long orderId);

    /** 客户已驳回建模、且该件尚未再次确认的订单。 */
    @Query("""
            select distinct p.orderId
            from OrderPiece p, ModelingInfo m
            where m.pieceId = p.id
              and p.orderId in :orderIds
              and (p.modelConfirmed = false or p.modelConfirmed is null)
              and m.lastCustomerRejectReason is not null
              and trim(m.lastCustomerRejectReason) <> ''
            """)
    List<Long> findOrderIdsWithOpenCustomerModelReject(@Param("orderIds") Collection<Long> orderIds);
}
