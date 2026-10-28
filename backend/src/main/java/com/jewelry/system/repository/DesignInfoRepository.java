package com.jewelry.system.repository;

import com.jewelry.system.entity.DesignInfo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DesignInfoRepository extends JpaRepository<DesignInfo, Long> {

    Optional<DesignInfo> findFirstByOrderIdOrderByIdAsc(Long orderId);

    /** 兼容旧调用：一单多件时取最早一条设计记录，避免 NonUniqueResultException */
    default Optional<DesignInfo> findByOrderId(Long orderId) {
        return findFirstByOrderIdOrderByIdAsc(orderId);
    }

    Optional<DesignInfo> findByPieceId(Long pieceId);

    List<DesignInfo> findByPieceIdIn(Collection<Long> pieceIds);

    List<DesignInfo> findAllByOrderId(Long orderId);

    /** 客户已驳回设计、且该件尚未再次确认的订单。 */
    @Query("""
            select distinct p.orderId
            from OrderPiece p, DesignInfo d
            where d.pieceId = p.id
              and p.orderId in :orderIds
              and (p.designConfirmed = false or p.designConfirmed is null)
              and d.lastCustomerRejectReason is not null
              and trim(d.lastCustomerRejectReason) <> ''
            """)
    List<Long> findOrderIdsWithOpenCustomerDesignReject(@Param("orderIds") Collection<Long> orderIds);
}
