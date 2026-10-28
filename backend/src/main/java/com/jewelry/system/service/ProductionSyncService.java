package com.jewelry.system.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.order.OrderProductionFollowLogDto;
import com.jewelry.system.dto.order.ProductionSyncDtos;
import com.jewelry.system.entity.*;
import com.jewelry.system.enums.OrderEventType;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.enums.ProductionProcess;
import com.jewelry.system.repository.*;
import com.jewelry.system.security.AccountKind;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ProductionSyncService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final OrderRepository orderRepository;
    private final OrderPieceRepository orderPieceRepository;
    private final ModelingInfoRepository modelingInfoRepository;
    private final DesignInfoRepository designInfoRepository;
    private final OrderProductionFollowLogRepository logRepository;
    private final ProductionProcessPhotoRepository photoRepository;
    private final FileEntityRepository fileEntityRepository;
    private final OrderFileService orderFileService;
    private final OrderEventService orderEventService;
    private final OrderProductionFollowService orderProductionFollowService;
    private final OrderCommandService orderCommandService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<ProductionSyncDtos.ProcessSummary> summaries() {
        long uid = requireTrackerOrAdmin();
        List<ProductionSyncDtos.ProcessSummary> list = new ArrayList<>();
        for (ProductionProcess process : ProductionProcess.values()) {
            list.add(ProductionSyncDtos.ProcessSummary.builder()
                    .code(process.name())
                    .label(process.getLabel())
                    .unmatchedCount(photoRepository.countByUploaderUserIdAndProcessCodeAndMatchedAtIsNull(uid, process.name()))
                    .build());
        }
        return list;
    }

    @Transactional(readOnly = true)
    public ProductionSyncDtos.Board board(String processCode) {
        long uid = requireTrackerOrAdmin();
        ProductionProcess process = parseProcess(processCode);
        return ProductionSyncDtos.Board.builder()
                .processCode(process.name())
                .processLabel(process.getLabel())
                .pieces(openPieces(uid, process))
                .photos(unmatchedPhotos(uid, process))
                .recentLogs(recentLogs(uid))
                .build();
    }

    @Transactional
    public ProductionSyncDtos.PoolPhoto upload(String processCode, MultipartFile file) throws java.io.IOException {
        long uid = requireTrackerOrAdmin();
        ProductionProcess process = parseProcess(processCode);
        var saved = orderFileService.uploadProcessPoolImage(file, process.name(), uid);
        ProductionProcessPhoto photo = new ProductionProcessPhoto();
        photo.setProcessCode(process.name());
        photo.setFileId(saved.getId());
        photo.setUploaderUserId(uid);
        photo = photoRepository.save(photo);
        return toPhoto(photo);
    }

    @Transactional
    public void discard(long photoId) {
        long uid = requireTrackerOrAdmin();
        ProductionProcessPhoto photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "照片不存在"));
        if (!Long.valueOf(uid).equals(photo.getUploaderUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "只能删除自己拍摄的未匹配照片");
        }
        if (photo.getMatchedAt() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "已匹配的照片不能删除");
        }
        photoRepository.delete(photo);
    }

    @Transactional
    public OrderProductionFollowLogDto match(ProductionSyncDtos.MatchRequest req) {
        long uid = requireTrackerOrAdmin();
        if (req == null || req.getPhotoId() == null || req.getOrderId() == null || req.getPieceId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择照片和对应单件");
        }
        ProductionProcessPhoto photo = photoRepository.findById(req.getPhotoId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "照片不存在"));
        if (!Long.valueOf(uid).equals(photo.getUploaderUserId()) && !isAdmin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "只能使用自己拍摄的照片");
        }
        if (photo.getMatchedAt() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "这张照片已经匹配过订单");
        }
        ProductionProcess process = parseProcess(photo.getProcessCode());
        Order order = orderRepository.findById(req.getOrderId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
        assertCanTouch(order, uid);
        if (!canSyncProcess(order.getStatus(), process)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    process == ProductionProcess.WAX
                            ? "仅待工艺验证或生产中的订单可以同步喷蜡"
                            : "仅生产中的订单可以同步工序进度");
        }
        OrderPiece piece = orderPieceRepository.findById(req.getPieceId())
                .filter(p -> order.getId().equals(p.getOrderId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "单件不属于该订单"));
        if (logRepository.existsByOrderIdAndPieceIdAndProcessCode(order.getId(), piece.getId(), process.name())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "该单件的这一工序已经同步过");
        }
        FileEntity file = fileEntityRepository.findById(photo.getFileId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "照片文件不存在"));

        OrderProductionFollowLog row = new OrderProductionFollowLog();
        row.setOrderId(order.getId());
        row.setPieceId(piece.getId());
        row.setProcessCode(process.name());
        row.setAuthorUserId(uid);
        row.setNote(piece.getName() + " 已完成" + process.getLabel());
        try {
            row.setImageFileIdsJson(objectMapper.writeValueAsString(List.of(file.getId())));
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "图片记录失败");
        }
        logRepository.saveAndFlush(row);

        photo.setMatchedOrderId(order.getId());
        photo.setMatchedPieceId(piece.getId());
        photo.setMatchedAt(LocalDateTime.now());
        photoRepository.save(photo);

        String snapshot = null;
        if (file.getFileUrl() != null && !file.getFileUrl().isBlank()) {
            try {
                snapshot = objectMapper.writeValueAsString(Map.of("images", List.of(file.getFileUrl())));
            } catch (JsonProcessingException ignored) {
                snapshot = null;
            }
        }
        orderEventService.record(order.getId(), OrderEventType.PRODUCTION_LOG,
                AccountKind.STAFF, uid, "FOLLOW_UP",
                "生产进度 · " + process.getLabel(),
                piece.getName() + " 已完成" + process.getLabel(),
                null, List.of(file.getId()), piece.getId(), snapshot);
        if (process == ProductionProcess.WAX) {
            orderCommandService.passReviewIfAllPiecesWaxed(order.getId(), uid);
        }
        return orderProductionFollowService.toDto(row);
    }

    private List<ProductionSyncDtos.PieceCard> openPieces(long uid, ProductionProcess process) {
        Specification<Order> spec = (root, query, cb) -> {
            var predicates = new ArrayList<jakarta.persistence.criteria.Predicate>();
            if (process == ProductionProcess.WAX) {
                predicates.add(root.get("status").in(
                        OrderStatus.PENDING_REVIEW, OrderStatus.PENDING_PRODUCTION, OrderStatus.PRODUCING));
            } else {
                predicates.add(root.get("status").in(OrderStatus.PENDING_PRODUCTION, OrderStatus.PRODUCING));
            }
            if (!isAdmin()) {
                predicates.add(cb.equal(root.get("followUp").get("id"), uid));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        List<ProductionSyncDtos.PieceCard> cards = new ArrayList<>();
        for (Order order : orderRepository.findAll(spec)) {
            for (OrderPiece piece : orderPieceRepository.findByOrderIdOrderBySeqAsc(order.getId())) {
                if (logRepository.existsByOrderIdAndPieceIdAndProcessCode(order.getId(), piece.getId(), process.name())) {
                    continue;
                }
                cards.add(ProductionSyncDtos.PieceCard.builder()
                        .orderId(order.getId())
                        .orderNumber(order.getOrderNumber())
                        .pieceId(piece.getId())
                        .pieceName(piece.getName())
                        .thumbnailUrl(thumbnailOf(piece.getId()))
                        .build());
            }
        }
        return cards;
    }

    private List<ProductionSyncDtos.PoolPhoto> unmatchedPhotos(long uid, ProductionProcess process) {
        return photoRepository.findByUploaderUserIdAndProcessCodeAndMatchedAtIsNullOrderByIdDesc(uid, process.name())
                .stream()
                .map(this::toPhoto)
                .toList();
    }

    private List<OrderProductionFollowLogDto> recentLogs(long uid) {
        List<OrderProductionFollowLog> rows = new ArrayList<>(
                logRepository.findTop40ByAuthorUserIdOrderByIdDesc(uid));
        Collections.reverse(rows);
        return rows.stream().map(orderProductionFollowService::toDto).toList();
    }

    private ProductionSyncDtos.PoolPhoto toPhoto(ProductionProcessPhoto photo) {
        return ProductionSyncDtos.PoolPhoto.builder()
                .id(photo.getId())
                .fileId(photo.getFileId())
                .createdAt(photo.getCreatedAt() != null ? ISO.format(photo.getCreatedAt()) : null)
                .build();
    }

    private String thumbnailOf(Long pieceId) {
        String fromModel = modelingInfoRepository.findByPieceId(pieceId)
                .map(ModelingInfo::getModelEffectImagesJson)
                .map(this::firstUrl)
                .orElse(null);
        if (fromModel != null) {
            return fromModel;
        }
        return designInfoRepository.findByPieceId(pieceId)
                .map(DesignInfo::getDesignImagesJson)
                .map(this::firstUrl)
                .orElse(null);
    }

    private String firstUrl(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            List<String> list = objectMapper.readValue(json,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
            if (list == null) {
                return null;
            }
            return list.stream().filter(s -> s != null && !s.isBlank()).findFirst().orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    private void assertCanTouch(Order order, long uid) {
        if (isAdmin()) {
            return;
        }
        if (order.getFollowUp() == null || !Long.valueOf(uid).equals(order.getFollowUp().getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅本单跟单员可以同步进度");
        }
    }

    private long requireTrackerOrAdmin() {
        String role = SecurityUtils.currentRoleApi().orElse("");
        if (!"ADMIN".equals(role) && !"TRACKER".equals(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅跟单员或管理员可以使用工序跟单");
        }
        return SecurityUtils.currentStaffUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
    }

    private boolean isAdmin() {
        return "ADMIN".equals(SecurityUtils.currentRoleApi().orElse(""));
    }

    private static boolean canSyncProcess(OrderStatus status, ProductionProcess process) {
        if (status == OrderStatus.PRODUCING || status == OrderStatus.PENDING_PRODUCTION) {
            return true;
        }
        return process == ProductionProcess.WAX && status == OrderStatus.PENDING_REVIEW;
    }

    private static ProductionProcess parseProcess(String code) {
        try {
            return ProductionProcess.fromCode(code);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }
}
