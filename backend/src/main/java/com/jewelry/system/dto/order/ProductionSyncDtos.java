package com.jewelry.system.dto.order;

import lombok.Builder;
import lombok.Data;

import java.util.List;

public final class ProductionSyncDtos {
    private ProductionSyncDtos() {}

    @Data
    @Builder
    public static class ProcessSummary {
        private String code;
        private String label;
        private long unmatchedCount;
    }

    @Data
    @Builder
    public static class PieceCard {
        private Long orderId;
        private String orderNumber;
        private Long pieceId;
        private String pieceName;
        private String thumbnailUrl;
    }

    @Data
    @Builder
    public static class PoolPhoto {
        private Long id;
        private Long fileId;
        private String createdAt;
    }

    @Data
    @Builder
    public static class Board {
        private String processCode;
        private String processLabel;
        private List<PieceCard> pieces;
        private List<PoolPhoto> photos;
        private List<OrderProductionFollowLogDto> recentLogs;
    }

    @Data
    public static class MatchRequest {
        private Long photoId;
        private Long orderId;
        private Long pieceId;
    }
}
