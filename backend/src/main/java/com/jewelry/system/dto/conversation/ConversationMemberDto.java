package com.jewelry.system.dto.conversation;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class ConversationMemberDto {
    private Long id;
    private String accountType;
    private Long accountId;
    private String role;
    private String displayName;
    private Long lastReadMessageId;
    private LocalDateTime joinedAt;
}
