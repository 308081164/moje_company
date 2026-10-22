package com.jewelry.system.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.order.OrderModelUpdateRequest;
import com.jewelry.system.dto.order.OrderModelVersionDto;
import com.jewelry.system.entity.ModelingInfo;
import com.jewelry.system.entity.ModelingInfoVersion;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.OrderPiece;
import com.jewelry.system.repository.ModelingInfoRepository;
import com.jewelry.system.repository.ModelingInfoVersionRepository;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.UserRepository;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ModelVersionService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final ModelingInfoVersionRepository versionRepository;
    private final ModelingInfoRepository modelingInfoRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final OrderPieceService orderPieceService;
    private final ObjectMapper objectMapper;

    public List<OrderModelVersionDto> listVersions(long orderId, long pieceId) {
        orderPieceService.requirePiece(orderId, pieceId);
        return versionRepository.findByPieceIdOrderByVersionNoDesc(pieceId).stream()
                .map(this::toSummaryDto)
                .collect(Collectors.toList());
    }

    public OrderModelVersionDto getVersion(long orderId, long pieceId, long versionId) {
        orderPieceService.requirePiece(orderId, pieceId);
        ModelingInfoVersion v = versionRepository.findById(versionId)
                .filter(row -> row.getPieceId().equals(pieceId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "版本不存在"));
        return toFullDto(v);
    }

    @Transactional
    public OrderModelVersionDto createVersionSnapshot(
            long orderId,
            OrderPiece piece,
            OrderModelUpdateRequest req,
            String modelFilesJson,
            boolean submittedToCustomer,
            String label
    ) {
        int nextNo = nextVersionNo(piece.getId());
        ModelingInfoVersion v = new ModelingInfoVersion();
        v.setOrderId(orderId);
        v.setPieceId(piece.getId());
        v.setVersionNo(nextNo);
        v.setLabel(label != null && !label.isBlank() ? label.trim() : "v" + nextNo);
        v.setModelerId(req.getModelerId());
        if (req.getWeight() != null) {
            v.setWeight(BigDecimal.valueOf(req.getWeight()));
        }
        v.setModelNotes(req.getModelNotes());
        v.setModelEffectImagesJson(toJson(req.getModelEffectImageUrls()));
        v.setModelFilesJson(modelFilesJson);
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
        ModelingInfoVersion v = versionRepository.findById(versionId)
                .filter(row -> row.getPieceId().equals(pieceId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "版本不存在"));

        ModelingInfo mi = modelingInfoRepository.findByPieceId(pieceId).orElseGet(() -> {
            ModelingInfo m = new ModelingInfo();
            m.setOrderId(orderId);
            m.setPieceId(pieceId);
            return m;
        });
        mi.setWeight(v.getWeight());
        mi.setModelNotes(v.getModelNotes());
        mi.setModelEffectImagesJson(v.getModelEffectImagesJson());
        mi.setModelFilesJson(v.getModelFilesJson());
        modelingInfoRepository.save(mi);

        if (v.getModelerId() != null) {
            order.setModeler(userRepository.getReferenceById(v.getModelerId()));
            orderRepository.save(order);
        }
    }

    private OrderModelVersionDto toSummaryDto(ModelingInfoVersion v) {
        return OrderModelVersionDto.builder()
                .id(v.getId())
                .orderId(v.getOrderId())
                .pieceId(v.getPieceId())
                .versionNo(v.getVersionNo())
                .label(v.getLabel())
                .submittedToCustomer(v.isSubmittedToCustomer())
                .createdBy(v.getCreatedBy())
                .createdByName(resolveUserName(v.getCreatedBy()))
                .createdAt(v.getCreatedAt() != null ? ISO.format(v.getCreatedAt()) : null)
                .build();
    }

    private OrderModelVersionDto toFullDto(ModelingInfoVersion v) {
        return OrderModelVersionDto.builder()
                .id(v.getId())
                .orderId(v.getOrderId())
                .pieceId(v.getPieceId())
                .versionNo(v.getVersionNo())
                .label(v.getLabel())
                .modelerId(v.getModelerId())
                .modelerName(resolveUserName(v.getModelerId()))
                .weight(v.getWeight() != null ? v.getWeight().doubleValue() : null)
                .modelNotes(v.getModelNotes())
                .modelEffectImages(parseStringList(v.getModelEffectImagesJson()))
                .modelFiles(parseJson(v.getModelFilesJson()))
                .submittedToCustomer(v.isSubmittedToCustomer())
                .createdBy(v.getCreatedBy())
                .createdByName(resolveUserName(v.getCreatedBy()))
                .createdAt(v.getCreatedAt() != null ? ISO.format(v.getCreatedAt()) : null)
                .build();
    }

    private int nextVersionNo(Long pieceId) {
        return versionRepository.findByPieceIdOrderByVersionNoDesc(pieceId).stream()
                .mapToInt(ModelingInfoVersion::getVersionNo)
                .findFirst()
                .orElse(0) + 1;
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
