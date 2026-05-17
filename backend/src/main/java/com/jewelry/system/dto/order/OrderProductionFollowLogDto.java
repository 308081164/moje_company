package com.jewelry.system.dto.order;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class OrderProductionFollowLogDto {
    private Long id;
    private Long orderId;
    private Long authorUserId;
    private String authorName;
    private String note;
    private List<Long> imageFileIds;
    private String createdAt;
}
