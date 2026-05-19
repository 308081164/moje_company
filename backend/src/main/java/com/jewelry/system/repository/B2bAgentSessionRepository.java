package com.jewelry.system.repository;

import com.jewelry.system.entity.B2bAgentSession;
import com.jewelry.system.enums.B2bAgentSessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface B2bAgentSessionRepository extends JpaRepository<B2bAgentSession, Long> {

    Optional<B2bAgentSession> findByPublicToken(String publicToken);

    List<B2bAgentSession> findByClientIdOrderByCreatedAtDesc(Long clientId);

    @Modifying
    @Query("UPDATE B2bAgentSession s SET s.status = :closed WHERE s.clientId = :clientId AND s.status = :active AND s.id <> :keepId")
    int closeOtherActiveForClient(
            @Param("clientId") Long clientId,
            @Param("active") B2bAgentSessionStatus active,
            @Param("closed") B2bAgentSessionStatus closed,
            @Param("keepId") Long keepId
    );
}
