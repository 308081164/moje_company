package com.jewelry.system.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.order.OrderDesignUpdateRequest;
import com.jewelry.system.dto.order.OrderDesignVersionDto;
import com.jewelry.system.entity.DesignInfo;
import com.jewelry.system.entity.DesignInfoVersion;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.OrderDetail;
import com.jewelry.system.entity.OrderPiece;
import com.jewelry.system.repository.DesignInfoRepository;
import com.jewelry.system.repository.DesignInfoVersionRepository;
import com.jewelry.system.repository.OrderDetailRepository;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.UserRepository;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DesignVersionService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final DesignInfoVersionRepository versionRepository;
    private final DesignInfoRepository designInfoRepository;
    private final OrderDetailRepository orderDetailRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final OrderPieceService orderPieceService;
    private final ObjectMapper objectMapper;

    public List<OrderDesignVersionDto> listVersions(long orderId, long pieceId) {
        orderPieceService.requirePiece(orderId, pieceId);
        return versionRepository.findByPieceIdOrderByVersionNoDesc(pieceId).stream()
                .map(this::toSummaryDto)
                .collect(Collectors.toList());
    }

    public OrderDesignVersionDto getVersion(long orderId, long pieceId, long versionId) {
        orderPieceService.requirePiece(orderId, pieceId);
        DesignInfoVersion v = versionRepository.findById(versionId)
                .filter(row -> row.getPieceId().equals(pieceId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "版本不存在"));
        return toFullDto(v);
    }

    @Transactional
    public OrderDesignVersionDto createVersionSnapshot(
            long orderId,
            OrderPiece piece,
            OrderDesignUpdateRequest req,
            boolean submittedToCustomer,
            String label
    ) {
        int nextNo = versionRepository.maxVersionNo(piece.getId()) + 1;
        DesignInfoVersion v = new DesignInfoVersion();
        v.setOrderId(orderId);
        v.setPieceId(piece.getId());
        v.setVersionNo(nextNo);
        v.setLabel(label != null && !label.isBlank() ? label.trim() : "v" + nextNo);
        v.setDesignerId(req.getDesignerId());
        v.setEngravingText(req.getEngravingText());
        v.setEngravingImagesJson(toJson(req.getEngravingImages()));
        v.setMaterialType(req.getMaterialType());
        v.setHandSize(req.getHandSize());
        v.setDesignNotes(req.getDesignNotes());
        v.setProcessInfoJson(toJson(req.getProcessInfo()));
        v.setStoneInfoJson(toJson(req.getStoneInfo()));
        v.setDesignImagesJson(toJson(req.getDesignImages()));
        v.setSubmittedToCustomer(submittedToCustomer);
        SecurityUtils.currentStaffUserId().ifPresent(v::setCreatedBy);
        versionRepository.save(v);
        return toFullDto(v);
    }

    @Transactional
    public void applyVersionToWorkingCopy(long orderId, long pieceId, long versionId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
        orderPieceService.requirePiece(orderId, pieceId);
        DesignInfoVersion v = versionRepository.findById(versionId)
                .filter(row -> row.getPieceId().equals(pieceId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "版本不存在"));

        OrderDetail od = orderDetailRepository.findByOrderId(orderId).orElseGet(() -> {
            OrderDetail d = new OrderDetail();
            d.setOrderId(orderId);
            return d;
        });
        od.setEngravingText(v.getEngravingText());
        od.setEngravingImagesJson(v.getEngravingImagesJson());
        od.setMaterialType(v.getMaterialType());
        od.setHandSize(v.getHandSize());
        od.setDesignNotes(v.getDesignNotes());
        orderDetailRepository.save(od);

        DesignInfo di = designInfoRepository.findByPieceId(pieceId).orElseGet(() -> {
            DesignInfo d = new DesignInfo();
            d.setOrderId(orderId);
            d.setPieceId(pieceId);
            return d;
        });
        di.setProcessInfoJson(v.getProcessInfoJson());
        di.setStoneInfoJson(v.getStoneInfoJson());
        di.setDesignImagesJson(v.getDesignImagesJson());
        designInfoRepository.save(di);

        if (v.getDesignerId() != null) {
            order.setDesigner(userRepository.getReferenceById(v.getDesignerId()));
            orderRepository.save(order);
        }
    }

    private OrderDesignVersionDto toSummaryDto(DesignInfoVersion v) {
        return OrderDesignVersionDto.builder()
                .id(v.getId())
                .orderId(v.getOrderId())
                .pieceId(v.getPieceId())
                .versionNo(v.getVersionNo())
                .label(v.getLabel())
                .submittedToCustomer(v.getSubmittedToCustomer())
                .createdBy(v.getCreatedBy())
                .createdByName(resolveUserName(v.getCreatedBy()))
                .createdAt(v.getCreatedAt() != null ? ISO.format(v.getCreatedAt()) : null)
                .build();
    }

    private OrderDesignVersionDto toFullDto(DesignInfoVersion v) {
        return OrderDesignVersionDto.builder()
                .id(v.getId())
                .orderId(v.getOrderId())
                .pieceId(v.getPieceId())
                .versionNo(v.getVersionNo())
                .label(v.getLabel())
                .designerId(v.getDesignerId())
                .designerName(resolveUserName(v.getDesignerId()))
                .engravingText(v.getEngravingText())
                .engravingImages(parseStringList(v.getEngravingImagesJson()))
                .materialType(v.getMaterialType())
                .handSize(v.getHandSize())
                .designNotes(v.getDesignNotes())
                .processInfo(parseJson(v.getProcessInfoJson()))
                .stoneInfo(parseJson(v.getStoneInfoJson()))
                .designImages(parseStringList(v.getDesignImagesJson()))
                .submittedToCustomer(v.getSubmittedToCustomer())
                .createdBy(v.getCreatedBy())
                .createdByName(resolveUserName(v.getCreatedBy()))
                .createdAt(v.getCreatedAt() != null ? ISO.format(v.getCreatedAt()) : null)
                .build();
    }

    private String resolveUserName(Long userId) {
        if (userId == null) {
            return null;
        }
        return userRepository.findById(userId)
                .map(u -> {
                    String rn = u.getRealName();
                    return rn != null && !rn.isBlank() ? rn : u.getUsername();
                })
                .orElse(null);
    }

    private String toJson(Object o) {
        if (o == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(o);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "JSON 序列化失败");
        }
    }

    private List<String> parseStringList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private Object parseJson(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, Object.class);
        } catch (Exception e) {
            return null;
        }
    }
}
