package com.jewelry.system.dto.b2b.agent;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class B2bAgentSessionDto {
    private Long sessionId;
    private String publicToken;
    private String status;
    private B2bAgentDraftDto draft;
    private List<B2bAgentMessageDto> messages;
    private boolean readOnly;
    private LocalDateTime createdAt;
}
