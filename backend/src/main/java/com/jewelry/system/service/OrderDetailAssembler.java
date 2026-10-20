package com.jewelry.system.service;

import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.order.*;
import com.jewelry.system.entity.*;
import com.jewelry.system.enums.ReviewResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class OrderDetailAssembler {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final ObjectMapper objectMapper;
    private final OrderPieceService orderPieceService;

    public OrderInfoDto enrich(
            OrderInfoDto base,
            Order order,
            OrderDetail od,
            DesignInfo di,
            ModelingInfo mi,
            ProcessReview pr,
            Quotation q
    ) {
        return enrich(base, order, od, di, mi, pr, q, null, null, null);
    }

    public OrderInfoDto enrich(
            OrderInfoDto base,
            Order order,
            OrderDetail od,
            DesignInfo di,
            ModelingInfo mi,
            ProcessReview pr,
            Quotation q,
            List<OrderPiece> pieces,
            List<DesignInfo> allDesign,
            List<ModelingInfo> allModel
    ) {
        if (base == null) {
            return null;
        }
        List<OrderPiece> pieceList = pieces != null ? pieces : orderPieceService.listByOrderId(order.getId());
        Map<Long, DesignInfo> designByPiece = indexDesignByPiece(allDesign, di);
        Map<Long, ModelingInfo> modelByPiece = indexModelByPiece(allModel, mi);

        List<OrderPieceDto> pieceDtos = pieceList.stream()
                .map(p -> {
                    OrderDesignBlockDto design = buildDesign(order, od, designByPiece.get(p.getId()), p.getId());
                    if (design != null) {
                        design.setDesignPassed(Boolean.TRUE.equals(p.getDesignConfirmed()));
                    }
                    OrderModelBlockDto model = buildModel(order, modelByPiece.get(p.getId()), p.getId());
                    if (model != null) {
                        model.setModelPassed(Boolean.TRUE.equals(p.getModelConfirmed()));
                    }
                    return OrderPieceDto.builder()
                            .id(p.getId())
                            .orderId(p.getOrderId())
                            .seq(p.getSeq())
                            .name(p.getName())
                            .designConfirmed(p.getDesignConfirmed())
                            .modelConfirmed(p.getModelConfirmed())
                            .referenceImages(orderPieceService.parseReferenceImages(p))
                            .design(design)
                            .model(model)
                            .build();
                })
                .collect(Collectors.toList());
        base.setPieces(pieceDtos);

        DesignInfo primaryDesign = pieceList.isEmpty() ? di : designByPiece.get(pieceList.get(0).getId());
        ModelingInfo primaryModel = pieceList.isEmpty() ? mi : modelByPiece.get(pieceList.get(0).getId());
        Long primaryPieceId = pieceList.isEmpty() ? null : pieceList.get(0).getId();
        base.setDesignInfo(buildDesign(order, od, primaryDesign, primaryPieceId));
        base.setModelInfo(buildModel(order, primaryModel, primaryPieceId));
        base.setReviewInfo(buildReview(order, pr));
        base.setQuotationInfo(buildQuotation(q));
        return base;
    }

    private Map<Long, DesignInfo> indexDesignByPiece(List<DesignInfo> allDesign, DesignInfo fallback) {
        Map<Long, DesignInfo> map = new HashMap<>();
        if (allDesign != null) {
            for (DesignInfo d : allDesign) {
                if (d.getPieceId() != null) {
                    map.put(d.getPieceId(), d);
                }
            }
        }
        if (fallback != null && fallback.getPieceId() != null) {
            map.putIfAbsent(fallback.getPieceId(), fallback);
        }
        return map;
    }

    private Map<Long, ModelingInfo> indexModelByPiece(List<ModelingInfo> allModel, ModelingInfo fallback) {
        Map<Long, ModelingInfo> map = new HashMap<>();
        if (allModel != null) {
            for (ModelingInfo m : allModel) {
                if (m.getPieceId() != null) {
                    map.put(m.getPieceId(), m);
                }
            }
        }
        if (fallback != null && fallback.getPieceId() != null) {
            map.putIfAbsent(fallback.getPieceId(), fallback);
        }
        return map;
    }

    private OrderDesignBlockDto buildDesign(Order order, OrderDetail od, DesignInfo di, Long pieceId) {
        User designer = order.getDesigner();
        Long designerId = designer != null ? designer.getId() : null;
        String designerName = designer != null
                ? (designer.getRealName() != null && !designer.getRealName().isBlank()
                ? designer.getRealName() : designer.getUsername())
                : null;

        Long rowId = od != null ? od.getId() : null;
        if (rowId == null && di != null) {
            rowId = di.getId();
        }
        if (rowId == null) {
            rowId = order.getId();
        }

        String created = null;
        String updated = null;
        if (od != null) {
            created = od.getCreatedAt() != null ? ISO.format(od.getCreatedAt()) : null;
            updated = od.getUpdatedAt() != null ? ISO.format(od.getUpdatedAt()) : null;
        }
        if (di != null) {
            if (created == null && di.getCreatedAt() != null) {
                created = ISO.format(di.getCreatedAt());
            }
            if (updated == null && di.getUpdatedAt() != null) {
                updated = ISO.format(di.getUpdatedAt());
            }
        }

        return OrderDesignBlockDto.builder()
                .id(rowId)
                .orderId(order.getId())
                .pieceId(pieceId)
                .designerId(designerId)
                .designerName(designerName)
                .engravingText(od != null ? od.getEngravingText() : null)
                .engravingImages(od != null ? parseStringList(od.getEngravingImagesJson()) : null)
                .materialType(od != null ? od.getMaterialType() : null)
                .materialDetail(null)
                .handSize(od != null ? firstNonBlank(od.getHandSize(), od.getChainLength()) : null)
                .processInfo(di != null ? parseJson(di.getProcessInfoJson()) : null)
                .stoneInfo(di != null ? parseJson(di.getStoneInfoJson()) : null)
                .designNotes(od != null ? od.getDesignNotes() : null)
                .designImages(di != null ? parseStringList(di.getDesignImagesJson()) : null)
                .designPassed(di != null ? di.getCustomerApproved() : null)
                .designPassedTime(di != null && di.getApprovalTime() != null ? ISO.format(di.getApprovalTime()) : null)
                .createdAt(created)
                .updatedAt(updated)
                .build();
    }

    private OrderModelBlockDto buildModel(Order order, ModelingInfo mi, Long pieceId) {
        User modeler = order.getModeler();
        Long modelerId = modeler != null ? modeler.getId() : null;
        String modelerName = modeler != null
                ? (modeler.getRealName() != null && !modeler.getRealName().isBlank()
                ? modeler.getRealName() : modeler.getUsername())
                : null;

        if (mi == null) {
            return OrderModelBlockDto.builder()
                    .id(order.getId())
                    .orderId(order.getId())
                    .pieceId(pieceId)
                    .modelerId(modelerId)
                    .modelerName(modelerName)
                    .modelEffectImages(Collections.emptyList())
                    .build();
        }
        return OrderModelBlockDto.builder()
                .id(mi.getId())
                .orderId(order.getId())
                .pieceId(pieceId)
                .modelerId(modelerId)
                .modelerName(modelerName)
                .weight(mi.getWeight() != null ? mi.getWeight().doubleValue() : null)
                .modelFiles(parseJson(mi.getModelFilesJson()))
                .modelEffectImages(parseStringList(mi.getModelEffectImagesJson()))
                .modelNotes(mi.getModelNotes())
                .modelPassed(mi.getCustomerApproved())
                .modelPassedTime(mi.getApprovalTime() != null ? ISO.format(mi.getApprovalTime()) : null)
                .createdAt(mi.getCreatedAt() != null ? ISO.format(mi.getCreatedAt()) : null)
                .updatedAt(mi.getUpdatedAt() != null ? ISO.format(mi.getUpdatedAt()) : null)
                .lastRejectToDesignerMessage(mi.getModelerRejectToDesignerMessage())
                .lastRejectToDesignerAttachmentFileIds(parseLongIdList(mi.getModelerRejectToDesignerFileIdsJson()))
                .build();
    }

    private OrderReviewBlockDto buildReview(Order order, ProcessReview pr) {
        User tracker = order.getFollowUp();
        Long trackerId = tracker != null ? tracker.getId() : null;
        String trackerName = tracker != null
                ? (tracker.getRealName() != null && !tracker.getRealName().isBlank()
                ? tracker.getRealName() : tracker.getUsername())
                : null;

        if (pr == null) {
            return OrderReviewBlockDto.builder()
                    .id(order.getId())
                    .orderId(order.getId())
                    .trackerId(trackerId)
                    .trackerName(trackerName)
                    .rejectedProcesses(Collections.emptyList())
                    .reviewPassed(false)
                    .build();
        }
        List<String> rejected = parseStringList(pr.getDeletedProcessesJson());
        return OrderReviewBlockDto.builder()
                .id(pr.getId())
                .orderId(order.getId())
                .trackerId(trackerId)
                .trackerName(trackerName)
                .reviewNotes(pr.getReviewNotes())
                .rejectedProcesses(rejected)
                .rejectionReason(pr.getRejectedReasons())
                .reviewPassed(pr.getReviewResult() == ReviewResult.PASSED)
                .reviewPassedTime(pr.getReviewTime() != null ? ISO.format(pr.getReviewTime()) : null)
                .createdAt(pr.getReviewTime() != null ? ISO.format(pr.getReviewTime()) : null)
                .updatedAt(pr.getReviewTime() != null ? ISO.format(pr.getReviewTime()) : null)
                .build();
    }

    private OrderQuotationBlockDto buildQuotation(Quotation q) {
        if (q == null) {
            return null;
        }
        BigDecimal labor = nz(q.getLaborCost());
        BigDecimal add = nz(q.getAdditionalLaborCost());
        BigDecimal total = nz(q.getTotalAmount());
        return OrderQuotationBlockDto.builder()
                .id(q.getId())
                .orderId(q.getOrderId())
                .processCost(labor.add(add).doubleValue())
                .stoneCost(0d)
                .materialCost(0d)
                .weightCost(0d)
                .laborCost(labor.doubleValue())
                .designBuyout(Boolean.TRUE.equals(q.getHasDesignCopyright()))
                .designBuyoutCost(nz(q.getDesignCopyrightFee()).doubleValue())
                .certificateCost(nz(q.getAppraisalCertificateFee()).doubleValue())
                .certificateTypes(Collections.emptyList())
                .confidential(Boolean.TRUE.equals(q.getConfidential()))
                .otherCost(nz(q.getOtherFees()).doubleValue())
                .totalCost(total.doubleValue())
                .quotationNotes(q.getOtherNotes())
                .createdAt(q.getCreatedAt() != null ? ISO.format(q.getCreatedAt()) : null)
                .updatedAt(q.getUpdatedAt() != null ? ISO.format(q.getUpdatedAt()) : null)
                .build();
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) {
            return a;
        }
        if (b != null && !b.isBlank()) {
            return b;
        }
        return null;
    }

    private Object parseJson(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            return json;
        }
    }

    private List<String> parseStringList(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private List<Long> parseLongIdList(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            JavaType listOfLong = objectMapper.getTypeFactory().constructCollectionType(List.class, Long.class);
            List<Long> ids = objectMapper.readValue(json, listOfLong);
            if (ids == null) {
                return Collections.emptyList();
            }
            return ids.stream().filter(Objects::nonNull).toList();
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }
}
