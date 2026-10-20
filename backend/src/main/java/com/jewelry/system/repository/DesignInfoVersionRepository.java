package com.jewelry.system.repository;

import com.jewelry.system.entity.DesignInfoVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface DesignInfoVersionRepository extends JpaRepository<DesignInfoVersion, Long> {

    List<DesignInfoVersion> findByPieceIdOrderByVersionNoDesc(Long pieceId);

    Optional<DesignInfoVersion> findByPieceIdAndVersionNo(Long pieceId, int versionNo);
}
