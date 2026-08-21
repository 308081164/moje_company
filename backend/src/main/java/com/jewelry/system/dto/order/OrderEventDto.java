package com.jewelry.system.dto.order;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class OrderEventDto {
    private Long id;
    private Long orderId;
    private String eventType;
    private String actorType;
    private Long actorId;
    private String actorRole;
    private String actorName;
    private String title;
    private String content;
    private String reason;
    private List<Long> fileIds;
    private LocalDateTime createdAt;
}
