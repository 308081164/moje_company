package com.jewelry.system.repository;

import com.jewelry.system.entity.DesignInfo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DesignInfoRepository extends JpaRepository<DesignInfo, Long> {

    Optional<DesignInfo> findFirstByOrderIdOrderByIdAsc(Long orderId);

    /** 兼容旧调用：一单多件时取最早一条设计记录，避免 NonUniqueResultException */
    default Optional<DesignInfo> findByOrderId(Long orderId) {
        return findFirstByOrderIdOrderByIdAsc(orderId);
    }

    Optional<DesignInfo> findByPieceId(Long pieceId);

    List<DesignInfo> findAllByOrderId(Long orderId);
}
