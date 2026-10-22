package com.jewelry.system.repository;

import com.jewelry.system.entity.ModelingInfoVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ModelingInfoVersionRepository extends JpaRepository<ModelingInfoVersion, Long> {

    List<ModelingInfoVersion> findByPieceIdOrderByVersionNoDesc(Long pieceId);

    Optional<ModelingInfoVersion> findByPieceIdAndVersionNo(Long pieceId, int versionNo);
}
