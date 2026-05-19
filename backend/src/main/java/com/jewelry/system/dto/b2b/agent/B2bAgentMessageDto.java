package com.jewelry.system.dto.b2b.agent;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
public class B2bAgentMessageDto {
    private Long id;
    private String role;
    private String content;
    private Map<String, Object> payload;
    private LocalDateTime createdAt;
}
