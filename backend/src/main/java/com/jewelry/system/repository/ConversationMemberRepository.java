package com.jewelry.system.repository;

import com.jewelry.system.entity.ConversationMember;
import com.jewelry.system.security.AccountKind;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConversationMemberRepository extends JpaRepository<ConversationMember, Long> {

    List<ConversationMember> findByConversationIdOrderByJoinedAtAsc(Long conversationId);

    Optional<ConversationMember> findByConversationIdAndAccountTypeAndAccountId(
            Long conversationId, AccountKind accountType, Long accountId);

    boolean existsByConversationIdAndAccountTypeAndAccountId(
            Long conversationId, AccountKind accountType, Long accountId);

    List<ConversationMember> findByAccountTypeAndAccountId(AccountKind accountType, Long accountId);

    List<ConversationMember> findByConversationIdAndRole(Long conversationId, String role);

    void deleteByConversationIdAndAccountTypeAndAccountId(Long conversationId, AccountKind accountType, Long accountId);
}
