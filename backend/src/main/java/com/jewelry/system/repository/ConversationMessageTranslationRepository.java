package com.jewelry.system.repository;

import com.jewelry.system.entity.ConversationMessageTranslation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConversationMessageTranslationRepository extends JpaRepository<ConversationMessageTranslation, Long> {

    Optional<ConversationMessageTranslation> findByMessageIdAndTargetLang(Long messageId, String targetLang);

    List<ConversationMessageTranslation> findByMessageIdInAndTargetLang(List<Long> messageIds, String targetLang);
}
