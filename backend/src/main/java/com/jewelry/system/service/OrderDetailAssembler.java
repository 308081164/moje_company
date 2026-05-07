package com.jewelry.system.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.order.*;
import com.jewelry.system.entity.*;
import com.jewelry.system.enums.ReviewResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;

@Component
@RequiredArgsConstructor
public class OrderDetailAssembler {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final ObjectMapper objectMapper;

    public OrderInfoDto enrich(
            OrderInfoDto base,
            Order order,
            OrderDetail od,
            DesignInfo di,
            ModelingInfo mi,
            ProcessReview pr,
            Quotation q
    ) {
        if (base == null) {
            return null;
        }
        base.setDesignInfo(buildDesign(order, od, di));
        base.setModelInfo(buildModel(order, mi));
        base.setReviewInfo(buildReview(order, pr));
        base.setQuotationInfo(buildQuotation(q));
        return base;
    }

    private OrderDesignBlockDto buildDesign(Order order, OrderDetail od, DesignInfo di) {
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
                .designerId(designerId)
                .designerName(designerName)
                .engravingText(od != null ? od.getEngravingText() : null)
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

    private OrderModelBlockDto buildModel(Order order, ModelingInfo mi) {
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
                    .modelerId(modelerId)
                    .modelerName(modelerName)
                    .build();
        }
        return OrderModelBlockDto.builder()
                .id(mi.getId())
                .orderId(order.getId())
                .modelerId(modelerId)
                .modelerName(modelerName)
                .weight(mi.getWeight() != null ? mi.getWeight().doubleValue() : null)
                .modelFiles(parseJson(mi.getModelFilesJson()))
                .modelNotes(mi.getModelNotes())
                .modelPassed(mi.getCustomerApproved())
                .modelPassedTime(mi.getApprovalTime() != null ? ISO.format(mi.getApprovalTime()) : null)
                .createdAt(mi.getCreatedAt() != null ? ISO.format(mi.getCreatedAt()) : null)
                .updatedAt(mi.getUpdatedAt() != null ? ISO.format(mi.getUpdatedAt()) : null)
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
}
