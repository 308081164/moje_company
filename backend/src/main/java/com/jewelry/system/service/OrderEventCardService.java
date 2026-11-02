package com.jewelry.system.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.jewelry.system.dto.order.CustomerSubmitSpecDto;
import com.jewelry.system.dto.order.CustomerSubmitSpecItemDto;
import com.jewelry.system.dto.order.OrderEventDto;
import com.jewelry.system.entity.DesignInfo;
import com.jewelry.system.entity.ModelingInfo;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.OrderDetail;
import com.jewelry.system.entity.OrderEvent;
import com.jewelry.system.entity.User;
import com.jewelry.system.enums.OrderEventType;
import com.jewelry.system.repository.B2BClientRepository;
import com.jewelry.system.repository.DesignInfoRepository;
import com.jewelry.system.repository.ModelingInfoRepository;
import com.jewelry.system.entity.OrderPiece;
import com.jewelry.system.repository.CustomerOrderServiceRequestRepository;
import com.jewelry.system.repository.OrderDetailRepository;
import com.jewelry.system.repository.OrderEventRepository;
import com.jewelry.system.repository.OrderPieceRepository;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.PortalCustomerAccountRepository;
import com.jewelry.system.repository.UserRepository;
import com.jewelry.system.security.AccountKind;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * 订单事件卡片组装：为事件补齐可展示的图片、发送方与是否可交互等字段。
 * 仅依赖 repository，不依赖 ConversationService，避免循环依赖。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderEventCardService {

    private final DesignInfoRepository designInfoRepository;
    private final ModelingInfoRepository modelingInfoRepository;
    private final UserRepository userRepository;
    private final PortalCustomerAccountRepository portalCustomerAccountRepository;
    private final B2BClientRepository b2bClientRepository;
    private final OrderEventRepository orderEventRepository;
    private final OrderPieceRepository orderPieceRepository;
    private final OrderDetailRepository orderDetailRepository;
    private final OrderRepository orderRepository;
    private final OrderPieceService orderPieceService;
    private final CustomerOrderServiceRequestRepository serviceRequestRepository;
    private final ObjectMapper objectMapper;

    private static final Set<String> OPEN_SERVICE_STATUSES = Set.of("OPEN", "IN_PROGRESS");

    @Transactional(readOnly = true)
    public OrderEventDto assemble(OrderEvent event) {
        List<String> images = resolveImages(event);
        if (images == null || images.isEmpty()) {
            if (isCraftReview(event.getEventType()) || isShippingAddressEvent(event.getEventType())
                    || isInternalQualityHandoff(event)
                    || event.getEventType() == OrderEventType.DESIGN_OPTIONS_REQUEST
                    || event.getEventType() == OrderEventType.DESIGN_OPTIONS_FILLED) {
                images = List.of();
            } else {
                images = List.of(placeholderImage(event.getEventType()));
            }
        }
        String resolution = resolveResolution(event);
        String resolutionLabel = resolutionLabel(resolution, event.getEventType());
        boolean addressRequest = event.getEventType() == OrderEventType.SHIPPING_ADDRESS_REQUEST;
        boolean designOptions = event.getEventType() == OrderEventType.DESIGN_OPTIONS_REQUEST;
        boolean refundRequest = event.getEventType() == OrderEventType.REFUND_REQUESTED
                && event.getOrderId() != null
                && serviceRequestRepository.findFirstByOrderIdAndTypeAndStatusIn(
                        event.getOrderId(), CustomerOrderServiceRequestService.TYPE_REFUND, OPEN_SERVICE_STATUSES)
                .isPresent();
        boolean actionable = addressRequest
                ? !hasLaterEvent(event, OrderEventType.SHIPPED)
                : designOptions
                ? !hasLaterEvent(event, OrderEventType.DESIGN_OPTIONS_FILLED)
                : refundRequest
                || ((event.getEventType() == OrderEventType.DESIGN_SUBMIT
                || event.getEventType() == OrderEventType.MODEL_SUBMIT
                || event.getEventType() == OrderEventType.BALANCE_PAYMENT)
                && resolution == null);
        String actorRole = event.getActorRole();
        String actorName = resolveActorName(event.getActorType(), event.getActorId(), actorRole);
        if (event.getEventType() == OrderEventType.BALANCE_PAYMENT
                || event.getEventType() == OrderEventType.BALANCE_PAID) {
            actorRole = ConversationService.SYSTEM_EVENT_ROLE;
            actorName = ConversationService.SYSTEM_EVENT_NAME;
        }
        return OrderEventDto.builder()
                .id(event.getId())
                .orderId(event.getOrderId())
                .pieceId(event.getPieceId())
                .eventType(event.getEventType().name())
                .actorType(event.getActorType() != null ? event.getActorType().name() : null)
                .actorId(event.getActorId())
                .actorRole(actorRole)
                .actorName(actorName)
                .title(event.getTitle())
                .content(event.getContent())
                .reason(event.getReason())
                .fileIds(parseLongList(event.getFileIdsJson()))
                .images(images)
                .submitSpec(resolveSubmitSpec(event))
                .actionable(actionable)
                .resolution(resolution)
                .resolutionLabel(resolutionLabel)
                .createdAt(event.getCreatedAt())
                .build();
    }

    /**
     * 该单件最新一次设计/建模提交之后，客户是否尚未确认或驳回。
     * 与卡片 {@code actionable} 使用同一套后续事件规则。
     */
    @Transactional(readOnly = true)
    public boolean isSubmitAwaitingDecision(Long orderId, Long pieceId, OrderEventType submitType) {
        if (orderId == null || submitType == null) {
            return false;
        }
        OrderEvent latestSubmit = null;
        for (OrderEvent e : orderEventRepository.findByOrderIdOrderByIdAsc(orderId)) {
            if (e.getEventType() != submitType) {
                continue;
            }
            if (pieceId != null && e.getPieceId() != null && !pieceId.equals(e.getPieceId())) {
                continue;
            }
            latestSubmit = e;
        }
        return latestSubmit != null && resolveResolution(latestSubmit) == null;
    }

    private static boolean isCraftReview(OrderEventType type) {
        return type == OrderEventType.REVIEW_PASS || type == OrderEventType.REVIEW_REJECT;
    }

    /**
     * 设计师/建模师提交跟单质量评审：对客户仅展示文字进度，不展示设计稿/建模预览图。
     */
    static boolean isInternalQualityHandoff(OrderEvent event) {
        if (event == null || event.getEventType() != OrderEventType.STATUS_CHANGE) {
            return false;
        }
        String title = event.getTitle();
        if (!StringUtils.hasText(title)) {
            return false;
        }
        return title.contains("跟单质量评审")
                || title.contains("跟单工艺评审")
                || title.contains("交回跟单");
    }

    private static boolean isShippingAddressEvent(OrderEventType type) {
        return type == OrderEventType.SHIPPING_ADDRESS_REQUEST
                || type == OrderEventType.SHIPPING_ADDRESS_FILLED;
    }

    private boolean hasLaterEvent(OrderEvent event, OrderEventType type) {
        if (event.getId() == null || type == null) {
            return false;
        }
        for (OrderEvent later : orderEventRepository.findByOrderIdOrderByIdAsc(event.getOrderId())) {
            if (later.getId() != null && later.getId() > event.getId() && later.getEventType() == type) {
                return true;
            }
        }
        return false;
    }

    /** 判断客户对该提交事件已作出的决策：CONFIRM / REJECT / PAID / null。 */
    private String resolveResolution(OrderEvent event) {
        OrderEventType type = event.getEventType();
        if (type == null) {
            return null;
        }
        List<OrderEventType> followers = switch (type) {
            // 再次提交同件设计稿时，旧稿视为已关闭（SUPERSEDED）
            case DESIGN_SUBMIT -> List.of(
                    OrderEventType.DESIGN_CONFIRM, OrderEventType.DESIGN_REJECT, OrderEventType.DESIGN_SUBMIT);
            case MODEL_SUBMIT -> List.of(
                    OrderEventType.MODEL_CONFIRM, OrderEventType.MODEL_REJECT, OrderEventType.MODEL_SUBMIT);
            // 再次推送尾款时，旧支付卡视为已作废（SUPERSEDED）
            case BALANCE_PAYMENT -> List.of(OrderEventType.BALANCE_PAID, OrderEventType.BALANCE_PAYMENT);
            case SHIPPING_ADDRESS_REQUEST -> List.of(OrderEventType.SHIPPING_ADDRESS_FILLED);
            default -> List.of();
        };
        if (followers.isEmpty()) {
            return null;
        }
        List<OrderEvent> later = orderEventRepository.findByOrderIdOrderByIdAsc(event.getOrderId());
        Long pieceId = event.getPieceId();
        for (OrderEvent e : later) {
            if (e.getId() <= event.getId()) {
                continue;
            }
            if (pieceId != null && e.getPieceId() != null && !pieceId.equals(e.getPieceId())) {
                continue;
            }
            if (followers.contains(e.getEventType())) {
                return switch (e.getEventType()) {
                    case DESIGN_CONFIRM, MODEL_CONFIRM -> "CONFIRM";
                    case DESIGN_REJECT, MODEL_REJECT -> "REJECT";
                    case DESIGN_SUBMIT, MODEL_SUBMIT, BALANCE_PAYMENT -> "SUPERSEDED";
                    case BALANCE_PAID -> "PAID";
                    case SHIPPING_ADDRESS_FILLED -> "FILLED";
                    default -> null;
                };
            }
        }
        return null;
    }

    private static String resolutionLabel(String resolution, OrderEventType eventType) {
        if (resolution == null) {
            return null;
        }
        return switch (resolution) {
            case "CONFIRM" -> "已确认";
            case "REJECT" -> "已驳回";
            case "SUPERSEDED" -> eventType == OrderEventType.BALANCE_PAYMENT ? "已作废" : "已有新稿";
            case "PAID" -> "已支付";
            case "FILLED" -> "已填写";
            default -> null;
        };
    }

    private String placeholderImage(OrderEventType type) {
        String color = "#c9a96e";
        String label = "订单";
        if (type != null) {
            switch (type) {
                case MODEL_SUBMIT, MODEL_REJECT, MODEL_CONFIRM -> {
                    color = "#4a6fff";
                    label = "建模稿";
                }
                case DESIGN_SUBMIT, DESIGN_REJECT, DESIGN_CONFIRM -> {
                    color = "#c9a96e";
                    label = "设计稿";
                }
                case REVIEW_PASS, REVIEW_REJECT -> {
                    color = "#8b5cf6";
                    label = "工艺验证";
                }
                case QUOTATION -> {
                    color = "#f59e0b";
                    label = "报价";
                }
                case PRODUCTION_LOG -> {
                    color = "#22a5f7";
                    label = "生产跟单";
                }
                case SHIPPED, DELIVERED -> {
                    color = "#2ea043";
                    label = "物流";
                }
                default -> {
                    color = "#6b7280";
                    label = type.getDescription();
                }
            }
        }
        return svgDataUri(color, label);
    }

    private String svgDataUri(String color, String label) {
        String svg = "<svg xmlns='http://www.w3.org/2000/svg' width='640' height='420'>"
                + "<rect width='100%' height='100%' fill='" + color + "'/>"
                + "<rect x='24' y='24' width='592' height='372' fill='none' stroke='rgba(255,255,255,0.5)' stroke-width='2'/>"
                + "<text x='50%' y='50%' font-family='sans-serif' font-size='40' font-weight='bold' fill='#ffffff' text-anchor='middle' dominant-baseline='middle'>"
                + label + "</text></svg>";
        String encoded = java.util.Base64.getEncoder()
                .encodeToString(svg.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        return "data:image/svg+xml;base64," + encoded;
    }

    private String resolveActorName(AccountKind type, Long accountId, String actorRole) {
        try {
            String name = switch (type) {
                case STAFF -> userRepository.findById(accountId)
                        .map(u -> StringUtils.hasText(u.getRealName()) ? u.getRealName() : u.getUsername())
                        .orElse(null);
                case C_PORTAL_CUSTOMER -> portalCustomerAccountRepository.findById(accountId)
                        .map(a -> StringUtils.hasText(a.getDisplayName()) ? a.getDisplayName()
                                : (StringUtils.hasText(a.getEmail()) ? a.getEmail() : a.getContact()))
                        .orElse(null);
                case B2B_CLIENT -> b2bClientRepository.findById(accountId)
                        .map(c -> StringUtils.hasText(c.getCompanyName()) ? c.getCompanyName()
                                : (StringUtils.hasText(c.getContactPerson()) ? c.getContactPerson() : c.getContact()))
                        .orElse(null);
            };
            if (type == AccountKind.STAFF && StringUtils.hasText(name)) {
                String roleLabel = roleLabel(actorRole);
                if (StringUtils.hasText(roleLabel)) {
                    return name + "（" + roleLabel + "）";
                }
            }
            return name;
        } catch (Exception e) {
            log.warn("解析事件操作者姓名失败 type={} id={}", type, accountId, e);
            return null;
        }
    }

    private static String roleLabel(String role) {
        if (role == null || role.isBlank()) {
            return null;
        }
        return switch (role.trim().toUpperCase()) {
            case "DESIGNER" -> "设计师";
            case "MODELER" -> "建模师";
            case "FOLLOW_UP" -> "跟单员";
            case "SALES_MID" -> "售中客服";
            case "SALES_PRE" -> "售前客服";
            case "ADMIN" -> "管理员";
            default -> null;
        };
    }

    private List<String> resolveImages(OrderEvent event) {
        List<String> fromSnapshot = parseSnapshotImages(event.getSnapshotJson());
        if (!fromSnapshot.isEmpty()) {
            return fromSnapshot;
        }
        OrderEventType type = event.getEventType();
        if (type == null) {
            return List.of();
        }
        try {
            switch (type) {
                case DESIGN_SUBMIT, DESIGN_REJECT, DESIGN_CONFIRM -> {
                    if (event.getPieceId() != null) {
                        DesignInfo di = designInfoRepository.findByPieceId(event.getPieceId()).orElse(null);
                        return parseStringList(di != null ? di.getDesignImagesJson() : null);
                    }
                    DesignInfo di = designInfoRepository.findByOrderId(event.getOrderId()).orElse(null);
                    return parseStringList(di != null ? di.getDesignImagesJson() : null);
                }
                case MODEL_SUBMIT, MODEL_REJECT, MODEL_CONFIRM -> {
                    if (event.getPieceId() != null) {
                        ModelingInfo mi = modelingInfoRepository.findByPieceId(event.getPieceId()).orElse(null);
                        return parseStringList(mi != null ? mi.getModelEffectImagesJson() : null);
                    }
                    ModelingInfo mi = modelingInfoRepository.findByOrderId(event.getOrderId()).orElse(null);
                    return parseStringList(mi != null ? mi.getModelEffectImagesJson() : null);
                }
                case STATUS_CHANGE -> {
                    // 提交跟单评审：不对客户展示稿件预览
                    if (isInternalQualityHandoff(event)) {
                        return List.of();
                    }
                    // 来图定制/设计师设计的订单创建事件：展示客户上传的参考图/灵感图
                    List<OrderPiece> pieces = orderPieceRepository.findByOrderIdOrderBySeqAsc(event.getOrderId());
                    if (!pieces.isEmpty()) {
                        List<String> refs = orderPieceService.parseReferenceImages(pieces.get(0));
                        if (!refs.isEmpty()) {
                            return refs;
                        }
                    }
                    DesignInfo di = designInfoRepository.findByOrderId(event.getOrderId()).orElse(null);
                    return parseStringList(di != null ? di.getDesignImagesJson() : null);
                }
                default -> {
                    return List.of();
                }
            }
        } catch (Exception e) {
            log.warn("解析事件卡片图片失败 eventId={}", event.getId(), e);
            return List.of();
        }
    }

    private List<String> parseSnapshotImages(String snapshotJson) {
        if (!StringUtils.hasText(snapshotJson)) {
            return List.of();
        }
        try {
            var node = objectMapper.readTree(snapshotJson);
            if (node.has("images") && node.get("images").isArray()) {
                return objectMapper.convertValue(node.get("images"),
                        objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
            }
        } catch (Exception e) {
            log.warn("解析事件快照图片失败: {}", snapshotJson, e);
        }
        return List.of();
    }

    private List<String> parseStringList(String json) {
        if (!StringUtils.hasText(json)) {
            return List.of();
        }
        try {
            List<String> list = objectMapper.readValue(
                    json.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                    new TypeReference<List<String>>() {}
            );
            return list == null ? List.of() : list;
        } catch (Exception e) {
            log.warn("解析字符串列表 JSON 失败: {}", json, e);
            return List.of();
        }
    }

    private List<Long> parseLongList(String json) {
        if (!StringUtils.hasText(json)) {
            return null;
        }
        try {
            List<Long> list = objectMapper.readValue(
                    json.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                    new TypeReference<List<Long>>() {}
            );
            return list;
        } catch (Exception e) {
            log.warn("解析长整型列表 JSON 失败: {}", json, e);
            return null;
        }
    }

    private CustomerSubmitSpecDto resolveSubmitSpec(OrderEvent event) {
        if (event == null || event.getEventType() == null || event.getOrderId() == null) {
            return null;
        }
        OrderEventType type = event.getEventType();
        if (type != OrderEventType.DESIGN_SUBMIT && type != OrderEventType.MODEL_SUBMIT) {
            return null;
        }
        Long orderId = event.getOrderId();
        Long pieceId = event.getPieceId();
        DesignInfo design = pieceId != null
                ? designInfoRepository.findByPieceId(pieceId).orElse(null)
                : designInfoRepository.findByOrderId(orderId).orElse(null);
        OrderDetail detail = orderDetailRepository.findByOrderId(orderId).orElse(null);
        Order order = orderRepository.findById(orderId).orElse(null);

        List<CustomerSubmitSpecItemDto> items = new ArrayList<>();
        if (pieceId != null) {
            orderPieceRepository.findById(pieceId)
                    .map(OrderPiece::getName)
                    .filter(StringUtils::hasText)
                    .ifPresent(name -> items.add(specItem("单件", name.trim())));
        }
        String handSize = design != null && StringUtils.hasText(design.getHandSize())
                ? design.getHandSize().trim()
                : (detail != null && StringUtils.hasText(detail.getHandSize()) ? detail.getHandSize().trim() : null);
        addSpecText(items, "尺寸/手寸", handSize);

        String material = null;
        if (order != null && StringUtils.hasText(order.getMaterialInfo())) {
            material = order.getMaterialInfo().trim();
        } else if (detail != null && StringUtils.hasText(detail.getMaterialType())) {
            String label = com.jewelry.system.customerbrief.CustomerBriefCatalog.materialLabel(detail.getMaterialType());
            material = StringUtils.hasText(label) ? label : detail.getMaterialType().trim();
        }
        addSpecText(items, "金属", material);
        addSpecText(items, "电镀", design != null ? design.getPlating() : null);
        addSpecText(items, "字印", detail != null ? detail.getEngravingText() : null);
        appendProcessSpec(items, design != null ? design.getProcessInfoJson() : null);
        appendStoneSpec(items, design != null ? design.getStoneInfoJson() : null);
        addSpecText(items, "设计说明", detail != null ? detail.getDesignNotes() : null);

        if (type == OrderEventType.MODEL_SUBMIT) {
            ModelingInfo model = pieceId != null
                    ? modelingInfoRepository.findByPieceId(pieceId).orElse(null)
                    : modelingInfoRepository.findByOrderId(orderId).orElse(null);
            if (model != null && model.getWeight() != null) {
                addSpecText(items, "预估克重",
                        String.format(Locale.ROOT, "%.3f g", model.getWeight().doubleValue()));
            }
            addSpecText(items, "建模说明", model != null ? model.getModelNotes() : null);
        }

        List<String> engravingImages = detail != null
                ? parseStringList(detail.getEngravingImagesJson())
                : List.of();
        if (items.isEmpty() && engravingImages.isEmpty()) {
            return null;
        }
        return CustomerSubmitSpecDto.builder()
                .items(items.isEmpty() ? List.of() : List.copyOf(items))
                .engravingImages(engravingImages.isEmpty() ? List.of() : engravingImages)
                .build();
    }

    private static CustomerSubmitSpecItemDto specItem(String label, String value) {
        return CustomerSubmitSpecItemDto.builder().label(label).value(value).build();
    }

    private static void addSpecText(List<CustomerSubmitSpecItemDto> items, String label, String value) {
        if (!StringUtils.hasText(value)) {
            return;
        }
        items.add(specItem(label, value.trim()));
    }

    private void appendProcessSpec(List<CustomerSubmitSpecItemDto> items, String processJson) {
        if (!StringUtils.hasText(processJson)) {
            return;
        }
        try {
            JsonNode arr = objectMapper.readTree(processJson);
            if (!arr.isArray()) {
                return;
            }
            List<String> names = new ArrayList<>();
            StringBuilder noteLines = new StringBuilder();
            for (JsonNode node : arr) {
                if (node == null || !node.isObject()) {
                    continue;
                }
                String custom = textNode(node.get("customProcess"));
                String name = StringUtils.hasText(custom)
                        ? custom.trim()
                        : processTypeLabel(textNode(node.get("processType")));
                if (StringUtils.hasText(name)) {
                    names.add(name);
                }
                String notes = textNode(node.get("notes"));
                if (StringUtils.hasText(notes)) {
                    if (!noteLines.isEmpty()) {
                        noteLines.append('\n');
                    }
                    if (StringUtils.hasText(name)) {
                        noteLines.append(name).append('：').append(notes.trim());
                    } else {
                        noteLines.append(notes.trim());
                    }
                }
            }
            if (!names.isEmpty()) {
                addSpecText(items, "工艺", String.join("、", names));
            }
            if (!noteLines.isEmpty()) {
                addSpecText(items, "工艺备注", noteLines.toString());
            }
        } catch (Exception e) {
            log.warn("解析工艺 JSON 失败", e);
        }
    }

    private void appendStoneSpec(List<CustomerSubmitSpecItemDto> items, String stoneJson) {
        if (!StringUtils.hasText(stoneJson)) {
            return;
        }
        try {
            JsonNode arr = objectMapper.readTree(stoneJson);
            if (!arr.isArray() || arr.isEmpty()) {
                return;
            }
            StringBuilder block = new StringBuilder();
            int idx = 0;
            for (JsonNode node : arr) {
                if (node == null || !node.isObject()) {
                    continue;
                }
                idx++;
                if (block.length() > 0) {
                    block.append("\n\n");
                }
                if (arr.size() > 1) {
                    block.append('第').append(idx).append('颗').append('\n');
                }
                appendStoneLine(block, "石料", stoneTypeLabel(textNode(node.get("stoneType"))));
                appendStoneLine(block, "形状", stoneShapeLabel(textNode(node.get("shape"))));
                appendStoneLine(block, "尺寸", textNode(node.get("size")));
                JsonNode qty = node.get("quantity");
                if (qty != null && qty.isNumber()) {
                    appendStoneLine(block, "数量", String.valueOf(qty.asInt()));
                }
                JsonNode weight = node.get("weight");
                if (weight != null && weight.isNumber()) {
                    appendStoneLine(block, "克拉/重量",
                            String.format(Locale.ROOT, "%.3f", weight.asDouble()));
                }
                appendStoneLine(block, "备注", textNode(node.get("notes")));
            }
            if (block.length() > 0) {
                addSpecText(items, "石料", block.toString());
            }
        } catch (Exception e) {
            log.warn("解析石料 JSON 失败", e);
        }
    }

    private static void appendStoneLine(StringBuilder sb, String label, String value) {
        if (!StringUtils.hasText(value)) {
            return;
        }
        if (sb.length() > 0 && sb.charAt(sb.length() - 1) != '\n') {
            sb.append('\n');
        }
        sb.append(label).append('：').append(value.trim());
    }

    private static String textNode(JsonNode node) {
        if (node == null || node.isNull()) {
            return "";
        }
        if (node.isTextual()) {
            return node.asText("");
        }
        if (node.isNumber()) {
            return node.asText();
        }
        return node.asText("");
    }

    private static String processTypeLabel(String processType) {
        if (!StringUtils.hasText(processType)) {
            return "";
        }
        return switch (processType.trim().toUpperCase(Locale.ROOT)) {
            case "ENAMEL" -> "珐琅";
            case "WIRE_DRAWING" -> "拉丝";
            case "SAND_BLASTING" -> "喷砂";
            case "NAIL_SAND" -> "钉砂";
            case "OTHER" -> "其他";
            default -> processType.trim();
        };
    }

    private static String stoneTypeLabel(String stoneType) {
        if (!StringUtils.hasText(stoneType)) {
            return "";
        }
        return switch (stoneType.trim().toUpperCase(Locale.ROOT)) {
            case "DIAMOND" -> "钻石";
            case "RUBY" -> "红宝石";
            case "SAPPHIRE" -> "蓝宝石";
            case "EMERALD" -> "翡翠";
            case "JADE" -> "玉石";
            case "PEARL" -> "珍珠";
            case "CRYSTAL" -> "水晶";
            case "OTHER" -> "其他";
            default -> stoneType.trim();
        };
    }

    private static String stoneShapeLabel(String shape) {
        if (!StringUtils.hasText(shape)) {
            return "";
        }
        return switch (shape.trim().toUpperCase(Locale.ROOT)) {
            case "ROUND" -> "圆形";
            case "OVAL" -> "椭圆形";
            case "PEAR" -> "梨形";
            case "MARQUISE" -> "马眼形";
            case "HEART" -> "心形";
            case "PRINCESS" -> "公主方";
            case "EMERALD_CUT" -> "祖母绿形";
            case "CUSHION" -> "垫形";
            case "OTHER" -> "其他";
            default -> shape.trim();
        };
    }
}
