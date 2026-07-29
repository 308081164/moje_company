package com.moje.jewelry3d.inlay.repository;

import com.moje.jewelry3d.inlay.entity.InlayItemEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface InlayItemRepository extends JpaRepository<InlayItemEntity, String>, JpaSpecificationExecutor<InlayItemEntity> {

    Optional<InlayItemEntity> findByLegacyPath(String legacyPath);

    long countByStatus(String status);

    long countByMeshReadyTrue();

    long countByMeshIsProxyTrue();

    long countByHasPreviewTrue();

    @Query("SELECT i FROM InlayItemEntity i LEFT JOIN FETCH i.tags WHERE i.id = :id")
    Optional<InlayItemEntity> findByIdWithTags(@Param("id") String id);

    @Query("""
            SELECT i FROM InlayItemEntity i
            WHERE LOWER(i.displayName) LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(i.legacyPath) LIKE LOWER(CONCAT('%', :q, '%'))
            """)
    Page<InlayItemEntity> searchByKeyword(@Param("q") String keyword, Pageable pageable);
}
