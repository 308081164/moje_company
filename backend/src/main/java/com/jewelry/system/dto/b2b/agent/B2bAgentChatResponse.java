package com.jewelry.system.dto.b2b.agent;

import com.jewelry.system.dto.b2b.B2BOrderAccessDto;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class B2bAgentChatResponse {
    private B2bAgentSessionDto session;
    private B2bAgentMessageDto latestAssistantMessage;
    private boolean needLogin;
    private boolean showConfirmCard;
    private B2BOrderAccessDto orderResult;
    private String supportWecomQrUrl;
    private String supportWecomFallbackText;
}
