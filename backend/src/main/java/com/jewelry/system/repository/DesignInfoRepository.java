package com.jewelry.system.repository;

import com.jewelry.system.entity.DesignInfo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DesignInfoRepository extends JpaRepository<DesignInfo, Long> {

    Optional<DesignInfo> findByOrderId(Long orderId);

    Optional<DesignInfo> findByPieceId(Long pieceId);

    List<DesignInfo> findAllByOrderId(Long orderId);
}
