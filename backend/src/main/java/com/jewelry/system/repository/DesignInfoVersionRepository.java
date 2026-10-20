package com.jewelry.system.repository;

import com.jewelry.system.entity.DesignInfoVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DesignInfoVersionRepository extends JpaRepository<DesignInfoVersion, Long> {

    List<DesignInfoVersion> findByPieceIdOrderByVersionNoDesc(Long pieceId);

    Optional<DesignInfoVersion> findByPieceIdAndVersionNo(Long pieceId, int versionNo);

    @Query("select coalesce(max(v.versionNo), 0) from DesignInfoVersion v where v.pieceId = :pieceId")
    int maxVersionNo(@Param("pieceId") Long pieceId);
}
