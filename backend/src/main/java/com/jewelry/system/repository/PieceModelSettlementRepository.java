package com.jewelry.system.repository;

import com.jewelry.system.entity.PieceModelSettlement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PieceModelSettlementRepository extends JpaRepository<PieceModelSettlement, Long> {

    Optional<PieceModelSettlement> findByPieceId(Long pieceId);

    List<PieceModelSettlement> findByPieceIdIn(Collection<Long> pieceIds);
}
