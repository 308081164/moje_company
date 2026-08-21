package com.jewelry.system.repository;

import com.jewelry.system.entity.ConversationMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConversationMessageRepository extends JpaRepository<ConversationMessage, Long> {

    List<ConversationMessage> findByConversationIdOrderByIdAsc(Long conversationId);

    Optional<ConversationMessage> findTopByConversationIdOrderByIdDesc(Long conversationId);

    long countByConversationIdAndIdGreaterThan(Long conversationId, Long messageId);
}
