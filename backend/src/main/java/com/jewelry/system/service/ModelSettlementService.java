package com.jewelry.system.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.settlement.ModelSettlementFileDto;
import com.jewelry.system.dto.settlement.ModelSettlementItemDto;
import com.jewelry.system.dto.settlement.ModelSettlementSaveRequest;
import com.jewelry.system.entity.DesignInfo;
import com.jewelry.system.entity.ModelingInfo;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.OrderPiece;
import com.jewelry.system.entity.PieceModelSettlement;
import com.jewelry.system.entity.User;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.repository.DesignInfoRepository;
import com.jewelry.system.repository.ModelingInfoRepository;
import com.jewelry.system.repository.OrderPieceRepository;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.PieceModelSettlementRepository;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ModelSettlementService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final ModelingInfoRepository modelingInfoRepository;
    private final OrderRepository orderRepository;
    private final OrderPieceRepository orderPieceRepository;
    private final DesignInfoRepository designInfoRepository;
    private final PieceModelSettlementRepository settlementRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<ModelSettlementItemDto> list() {
        assertAdmin();
        List<ModelingInfo> models = modelingInfoRepository.findAll();
        if (models.isEmpty()) {
            return List.of();
        }
        Map<Long, Order> orders = new HashMap<>();
        for (Order order : orderRepository.findAllById(models.stream().map(ModelingInfo::getOrderId).distinct().toList())) {
            orders.put(order.getId(), order);
        }
        Map<Long, List<OrderPiece>> piecesByOrder = new HashMap<>();
        for (OrderPiece piece : orderPieceRepository.findAll()) {
            piecesByOrder.computeIfAbsent(piece.getOrderId(), id -> new ArrayList<>()).add(piece);
        }
        Map<Long, ModelingInfo> modelByPiece = new HashMap<>();
        for (ModelingInfo model : models) {
            OrderPiece piece = resolvePiece(model, piecesByOrder.getOrDefault(model.getOrderId(), List.of()));
            if (piece == null) {
                continue;
            }
            Order order = orders.get(model.getOrderId());
            if (order == null || order.getStatus() == OrderStatus.CANCELLED) {
                continue;
            }
            if (!hasModelMaterial(model, piece)) {
                continue;
            }
            modelByPiece.merge(piece.getId(), model, (left, right) ->
                    left.getId() != null && right.getId() != null && left.getId() > right.getId() ? left : right);
        }
        if (modelByPiece.isEmpty()) {
            return List.of();
        }
        Map<Long, DesignInfo> designByPiece = new HashMap<>();
        for (DesignInfo design : designInfoRepository.findByPieceIdIn(modelByPiece.keySet())) {
            designByPiece.put(design.getPieceId(), design);
        }
        Map<Long, PieceModelSettlement> saved = new HashMap<>();
        for (PieceModelSettlement row : settlementRepository.findByPieceIdIn(modelByPiece.keySet())) {
            saved.put(row.getPieceId(), row);
        }
        List<ModelSettlementItemDto> items = new ArrayList<>();
        for (Map.Entry<Long, ModelingInfo> entry : modelByPiece.entrySet()) {
            ModelingInfo model = entry.getValue();
            Order order = orders.get(model.getOrderId());
            OrderPiece piece = resolvePiece(model, piecesByOrder.getOrDefault(model.getOrderId(), List.of()));
            if (order == null || piece == null) {
                continue;
            }
            items.add(toDto(order, piece, model, designByPiece.get(piece.getId()), saved.get(piece.getId())));
        }
        items.sort(Comparator
                .comparing(ModelSettlementItemDto::isReviewed)
                .thenComparing(ModelSettlementItemDto::getModeledAt, Comparator.nullsLast(Comparator.reverseOrder())));
        return items;
    }

    @Transactional
    public ModelSettlementItemDto save(long pieceId, ModelSettlementSaveRequest req) {
        assertAdmin();
        if (req == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请填写核算内容");
        }
        String structure = blankToNull(req.getStructureComplexity());
        String texture = blankToNull(req.getTextureLevel());
        if (structure == null || !ModelSettlementScore.STRUCTURES.contains(structure)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择主体结构复杂度");
        }
        if (texture == null || !ModelSettlementScore.TEXTURES.contains(texture)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择是否含纹理");
        }
        OrderPiece piece = orderPieceRepository.findById(pieceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "单件不存在"));
        Order order = orderRepository.findById(piece.getOrderId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
        ModelingInfo model = modelingInfoRepository.findByPieceId(pieceId).orElse(null);
        if (model == null) {
            model = modelingInfoRepository.findAllByOrderId(order.getId()).stream().findFirst()
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "这件还没有建模记录"));
        }
        int simple = count(req.getSimpleComponentCount());
        int regular = count(req.getRegularCurveComponentCount());
        int irregular = count(req.getIrregularCurveComponentCount());
        int high = count(req.getHighDetailComponentCount());
        int simpleInlay = count(req.getSimpleInlayCount());
        int specialInlay = count(req.getSpecialInlayCount());
        int linear = count(req.getLinearStoneCount());
        int freeform = count(req.getFreeformStoneCount());
        int coefficient = ModelSettlementScore.coefficient(
                structure, texture, simple, regular, irregular, high, simpleInlay, specialInlay, linear, freeform);

        PieceModelSettlement row = settlementRepository.findByPieceId(pieceId).orElseGet(PieceModelSettlement::new);
        row.setPieceId(pieceId);
        row.setOrderId(order.getId());
        row.setStructureComplexity(structure);
        row.setTextureLevel(texture);
        row.setSimpleComponentCount(simple);
        row.setRegularCurveComponentCount(regular);
        row.setIrregularCurveComponentCount(irregular);
        row.setHighDetailComponentCount(high);
        row.setSimpleInlayCount(simpleInlay);
        row.setSpecialInlayCount(specialInlay);
        row.setLinearStoneCount(linear);
        row.setFreeformStoneCount(freeform);
        row.setCoefficient(coefficient);
        String note = req.getNote() == null ? null : req.getNote().trim();
        row.setNote(note == null || note.isEmpty() ? null : note.substring(0, Math.min(note.length(), 500)));
        row.setReviewerId(SecurityUtils.currentStaffUserId().orElse(null));
        row.setReviewedAt(java.time.LocalDateTime.now());
        settlementRepository.save(row);

        DesignInfo design = designInfoRepository.findByPieceId(pieceId).orElse(null);
        return toDto(order, piece, model, design, row);
    }

    private ModelSettlementItemDto toDto(
            Order order,
            OrderPiece piece,
            ModelingInfo model,
            DesignInfo design,
            PieceModelSettlement saved
    ) {
        User modeler = order.getModeler();
        String structure = saved == null ? null : saved.getStructureComplexity();
        String texture = saved == null ? null : saved.getTextureLevel();
        int simple = saved == null ? 0 : nz(saved.getSimpleComponentCount());
        int regular = saved == null ? 0 : nz(saved.getRegularCurveComponentCount());
        int irregular = saved == null ? 0 : nz(saved.getIrregularCurveComponentCount());
        int high = saved == null ? 0 : nz(saved.getHighDetailComponentCount());
        int simpleInlay = saved == null ? 0 : nz(saved.getSimpleInlayCount());
        int specialInlay = saved == null ? 0 : nz(saved.getSpecialInlayCount());
        int linear = saved == null ? 0 : nz(saved.getLinearStoneCount());
        int freeform = saved == null ? 0 : nz(saved.getFreeformStoneCount());
        int coefficient = saved != null && saved.getReviewedAt() != null
                ? nz(saved.getCoefficient())
                : ModelSettlementScore.coefficient(structure, texture, simple, regular, irregular, high, simpleInlay, specialInlay, linear, freeform);
        return ModelSettlementItemDto.builder()
                .pieceId(piece.getId())
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .orderStatus(order.getStatus() == null ? null : order.getStatus().name())
                .pieceName(piece.getName())
                .pieceSeq(piece.getSeq())
                .jewelryType(piece.getJewelryType() == null ? null : piece.getJewelryType().name())
                .modelerId(modeler == null ? null : modeler.getId())
                .modelerName(modeler == null ? null : firstName(modeler))
                .modeledAt(model.getUpdatedAt() != null ? ISO.format(model.getUpdatedAt()) : null)
                .modelConfirmed(Boolean.TRUE.equals(piece.getModelConfirmed()))
                .weight(model.getWeight() == null ? null : model.getWeight().doubleValue())
                .modelNotes(model.getModelNotes())
                .designImages(readStrings(design == null ? null : design.getDesignImagesJson()))
                .modelEffectImages(readStrings(model.getModelEffectImagesJson()))
                .modelFiles(readFiles(model.getModelFilesJson()))
                .processes(readProcesses(design == null ? null : design.getProcessInfoJson()))
                .stones(readStones(design == null ? null : design.getStoneInfoJson()))
                .reviewed(saved != null && saved.getReviewedAt() != null)
                .structureComplexity(structure)
                .textureLevel(texture)
                .simpleComponentCount(simple)
                .regularCurveComponentCount(regular)
                .irregularCurveComponentCount(irregular)
                .highDetailComponentCount(high)
                .simpleInlayCount(simpleInlay)
                .specialInlayCount(specialInlay)
                .linearStoneCount(linear)
                .freeformStoneCount(freeform)
                .coefficient(coefficient)
                .note(saved == null ? null : saved.getNote())
                .reviewedAt(saved != null && saved.getReviewedAt() != null ? ISO.format(saved.getReviewedAt()) : null)
                .build();
    }

    private OrderPiece resolvePiece(ModelingInfo model, List<OrderPiece> pieces) {
        if (pieces == null || pieces.isEmpty()) {
            return null;
        }
        if (model.getPieceId() != null) {
            for (OrderPiece piece : pieces) {
                if (model.getPieceId().equals(piece.getId())) {
                    return piece;
                }
            }
        }
        return pieces.stream().min(Comparator.comparing(OrderPiece::getSeq, Comparator.nullsLast(Integer::compareTo))).orElse(null);
    }

    private boolean hasModelMaterial(ModelingInfo model, OrderPiece piece) {
        if (Boolean.TRUE.equals(piece.getModelConfirmed())) {
            return true;
        }
        return !readStrings(model.getModelEffectImagesJson()).isEmpty() || !readFiles(model.getModelFilesJson()).isEmpty();
    }

    private List<String> readStrings(String json) {
        JsonNode node = read(json);
        if (node == null || !node.isArray()) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        for (JsonNode item : node) {
            if (item.isTextual() && !item.asText().isBlank()) {
                values.add(item.asText());
            } else if (item.isObject()) {
                String url = text(item, "url");
                if (url == null) {
                    url = text(item, "fileUrl");
                }
                if (url != null) {
                    values.add(url);
                }
            }
        }
        return values;
    }

    private List<ModelSettlementFileDto> readFiles(String json) {
        JsonNode node = read(json);
        if (node == null || !node.isArray()) {
            return List.of();
        }
        List<ModelSettlementFileDto> files = new ArrayList<>();
        for (JsonNode item : node) {
            if (item.isTextual() && !item.asText().isBlank()) {
                files.add(ModelSettlementFileDto.builder().name("源文件").url(item.asText()).build());
            } else if (item.isObject()) {
                String url = text(item, "fileUrl");
                if (url == null) {
                    url = text(item, "url");
                }
                String name = text(item, "fileName");
                if (name == null) {
                    name = text(item, "name");
                }
                if (url != null || name != null) {
                    files.add(ModelSettlementFileDto.builder().name(name == null ? "源文件" : name).url(url).build());
                }
            }
        }
        return files;
    }

    private List<String> readProcesses(String json) {
        JsonNode node = read(json);
        if (node == null || !node.isArray()) {
            return List.of();
        }
        List<String> lines = new ArrayList<>();
        for (JsonNode item : node) {
            if (!item.isObject()) {
                continue;
            }
            String name = text(item, "customProcess");
            if (name == null) {
                name = text(item, "processType");
            }
            if (name != null) {
                lines.add(name);
            }
        }
        return lines;
    }

    private List<String> readStones(String json) {
        JsonNode node = read(json);
        if (node == null || !node.isArray()) {
            return List.of();
        }
        List<String> lines = new ArrayList<>();
        for (JsonNode item : node) {
            if (!item.isObject()) {
                continue;
            }
            String type = text(item, "stoneType");
            String qty = text(item, "quantity");
            if (type == null && qty == null) {
                continue;
            }
            lines.add(qty == null ? type : type + " ×" + qty);
        }
        return lines;
    }

    private JsonNode read(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            return null;
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) {
            return null;
        }
        String text = value.asText();
        return text == null || text.isBlank() ? null : text;
    }

    private static String firstName(User user) {
        if (user.getRealName() != null && !user.getRealName().isBlank()) {
            return user.getRealName();
        }
        return user.getUsername();
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private static int count(Integer value) {
        if (value == null || value < 0) {
            return 0;
        }
        return Math.min(value, 99);
    }

    private static int nz(Integer value) {
        return value == null ? 0 : value;
    }

    private void assertAdmin() {
        if (!"ADMIN".equals(SecurityUtils.currentRoleApi().orElse(""))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可核算");
        }
    }
}
