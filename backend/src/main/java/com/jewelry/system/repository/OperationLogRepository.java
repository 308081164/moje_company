package com.jewelry.system.repository;

import com.jewelry.system.entity.OperationLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface OperationLogRepository extends JpaRepository<OperationLog, Long> {

    @Query("SELECT COUNT(l) FROM OperationLog l WHERE l.operationType = :type AND l.userId = :userId "
            + "AND l.createdAt >= :start AND l.createdAt < :end")
    long countByTypeAndUserAndCreatedAtRange(
            @Param("type") String type,
            @Param("userId") Long userId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end
    );
}

