package com.jewelry.system.repository;

import com.jewelry.system.entity.B2bAgentMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface B2bAgentMessageRepository extends JpaRepository<B2bAgentMessage, Long> {

    List<B2bAgentMessage> findBySessionIdOrderByCreatedAtAsc(Long sessionId);
}
