package com.jewelry.system.repository;

import com.jewelry.system.entity.InlayStructureDeleteLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface InlayStructureDeleteLogRepository extends JpaRepository<InlayStructureDeleteLog, Long> {

    @Query("SELECT COUNT(l) FROM InlayStructureDeleteLog l WHERE l.userId = :userId AND l.deletedAt >= :start AND l.deletedAt < :end")
    long countByUserIdAndDeletedAtBetween(@Param("userId") long userId,
                                          @Param("start") LocalDateTime start,
                                          @Param("end") LocalDateTime end);
}
