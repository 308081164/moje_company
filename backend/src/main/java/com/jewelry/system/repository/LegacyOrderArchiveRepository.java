package com.jewelry.system.repository;

import com.jewelry.system.entity.LegacyOrderArchive;
import com.jewelry.system.enums.LegacyOrderSegment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LegacyOrderArchiveRepository extends JpaRepository<LegacyOrderArchive, Long> {

    @Query("""
            SELECT a FROM LegacyOrderArchive a
            WHERE (:kw = '' OR LOWER(a.archiveCode) LIKE LOWER(CONCAT('%', :kw, '%'))
                OR LOWER(COALESCE(a.customerName,'')) LIKE LOWER(CONCAT('%', :kw, '%'))
                OR LOWER(COALESCE(a.customerPhone,'')) LIKE LOWER(CONCAT('%', :kw, '%'))
                OR LOWER(COALESCE(a.styleSummary,'')) LIKE LOWER(CONCAT('%', :kw, '%')))
            AND (:seg IS NULL OR a.segment = :seg)
            ORDER BY a.createdAt DESC
            """)
    Page<LegacyOrderArchive> pageSearch(
            @Param("kw") String keyword,
            @Param("seg") LegacyOrderSegment segment,
            Pageable pageable
    );
}
