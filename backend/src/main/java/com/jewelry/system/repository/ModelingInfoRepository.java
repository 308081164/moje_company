package com.jewelry.system.repository;

import com.jewelry.system.entity.ModelingInfo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ModelingInfoRepository extends JpaRepository<ModelingInfo, Long> {

    Optional<ModelingInfo> findFirstByOrderIdOrderByIdAsc(Long orderId);

    default Optional<ModelingInfo> findByOrderId(Long orderId) {
        return findFirstByOrderIdOrderByIdAsc(orderId);
    }

    Optional<ModelingInfo> findByPieceId(Long pieceId);

    List<ModelingInfo> findAllByOrderId(Long orderId);
}
