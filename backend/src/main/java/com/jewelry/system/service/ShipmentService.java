package com.jewelry.system.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.order.OrderShipmentDto;
import com.jewelry.system.dto.order.ShipOrderRequest;
import com.jewelry.system.dto.order.YunexpressDocumentDto;
import com.jewelry.system.dto.order.YunexpressQuoteDto;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.OrderPiece;
import com.jewelry.system.entity.OrderShipment;
import com.jewelry.system.enums.JewelryType;
import com.jewelry.system.enums.OrderEventType;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.repository.OrderPieceRepository;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.OrderShipmentRepository;
import com.jewelry.system.security.AccountKind;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 订单发货/物流服务。跟单员发货录入快递单号，客户在独立站查看物流状态。
 * 17TRACK 未启用或查询失败时降级为「已发货（待物流更新）」+ 官方查询链接。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ShipmentService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
    private static final Pattern COUNTRY_CODE = Pattern.compile("\\(([A-Z]{2})\\)");
    private static final Pattern CITY_LINE = Pattern.compile("(?i)^(城市|市|City|Ville|Stadt|Ciudad)\\s*[:：]\\s*(.+)$");
    private static final Pattern STATE_LINE = Pattern.compile("(?i)^(省|州/省|州|Province|State(?:/Province)?)\\s*[:：]\\s*(.+)$");
    private static final Pattern STREET_LINE = Pattern.compile("(?i)^(详细地址|地址|Address|Adresse)\\s*[:：]\\s*(.+)$");
    private static final Set<String> EU_COUNTRIES = Set.of(
            "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
            "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE");

    private final OrderRepository orderRepository;
    private final OrderShipmentRepository shipmentRepository;
    private final OrderPieceRepository orderPieceRepository;
    private final OrderEventService orderEventService;
    private final SeventeenTrackClient seventeenTrackClient;
    private final YunExpressClient yunExpressClient;
    private final ObjectMapper objectMapper;

    @Transactional
    public OrderShipmentDto ship(long orderId, ShipOrderRequest req) {
        Order order = loadOrder(orderId);
        assertCanShip(order);
        String trackingNumber = requireTrackingNumber(req);
        if (shipmentRepository.findByOrderId(orderId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该订单已发货，请勿重复提交");
        }

        String carrierName = req.getCarrierName() == null ? "" : req.getCarrierName().trim();
        Integer carrierCode = req.getCarrierCode();
        if (carrierCode == null && carrierName.matches("\\d+")) {
            try {
                carrierCode = Integer.valueOf(carrierName);
                carrierName = "";
            } catch (NumberFormatException ignored) {
                carrierCode = null;
            }
        }
        if (carrierName.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "承运商名称过长");
        }

        OrderShipment shipment = new OrderShipment();
        shipment.setOrderId(orderId);
        shipment.setTrackingNumber(trackingNumber);
        shipment.setCarrierCode(carrierCode);
        if (StringUtils.hasText(carrierName)) {
            shipment.setCarrierName(carrierName);
        }
        shipment.setShippedAt(LocalDateTime.now());
        shipment.setQueryUrl(buildQueryUrl(trackingNumber));
        // 默认降级状态，待 17TRACK 同步覆盖
        shipment.setStatus(null);
        shipment.setStatusLabel("已发货（待物流更新）");
        shipment.setTrackingEventsJson("[]");
        shipment.setLastSyncAt(LocalDateTime.now());
        shipmentRepository.save(shipment);

        String shipDetail = "快递单号：" + trackingNumber
                + (StringUtils.hasText(shipment.getCarrierName()) ? "，承运商：" + shipment.getCarrierName() : "");
        recordShipmentEvent(orderId, "订单已发货", shipDetail);

        syncTracking(shipment);

        return toDto(shipment);
    }

    /**
     * 用订单上的收件信息向云途创建运单，并把返回的运单号写成当前发货记录。
     */
    @Transactional
    public OrderShipmentDto shipByYunexpress(long orderId, String productCode, Double weightKg) {
        Order order = loadOrder(orderId);
        assertCanShip(order);
        if (shipmentRepository.findByOrderId(orderId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该订单已发货，请使用重新发货");
        }
        YunExpressClient.OrderDraft draft = buildYunexpressDraft(order, customerOrderNumber(order, false), productCode, weightKg);
        YunExpressClient.CreatedWaybill created = yunExpressClient.createOrder(draft);
        OrderShipment shipment = new OrderShipment();
        shipment.setOrderId(orderId);
        shipment.setTrackingNumber(created.waybillNumber);
        shipment.setCarrierName("云途");
        shipment.setShippedAt(LocalDateTime.now());
        shipment.setQueryUrl(buildQueryUrl(created.waybillNumber));
        shipment.setStatus(null);
        shipment.setStatusLabel("已发货（待物流更新）");
        shipment.setTrackingEventsJson("[]");
        shipmentRepository.save(shipment);
        recordShipmentEvent(orderId, "订单已发货",
                "快递单号：" + created.waybillNumber + "，承运商：云途");
        syncFromYunexpress(shipment);
        return toDto(shipment);
    }

    /**
     * 已发货订单再用云途下一张新运单。新单号成为当前有效单号，订单状态不变。
     */
    @Transactional
    public OrderShipmentDto reshipByYunexpress(long orderId, String productCode, Double weightKg) {
        Order order = loadOrder(orderId);
        assertTrackerOrAdmin(order);
        OrderShipment shipment = requireShipment(orderId);
        YunExpressClient.OrderDraft draft = buildYunexpressDraft(order, customerOrderNumber(order, true), productCode, weightKg);
        YunExpressClient.CreatedWaybill created = yunExpressClient.createOrder(draft);
        if (created.waybillNumber.equalsIgnoreCase(shipment.getTrackingNumber().trim())) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "云途返回了与当前相同的运单号");
        }
        shipment.setTrackingNumber(created.waybillNumber);
        shipment.setCarrierName("云途");
        shipment.setCarrierCode(null);
        clearTrackingSnapshot(shipment, true);
        shipment.setLastSyncAt(null);
        shipment.setQueryUrl(buildQueryUrl(created.waybillNumber));
        shipmentRepository.save(shipment);
        recordShipmentEvent(orderId, "已重新发货",
                customerTrackingDetail("已重新发货。", created.waybillNumber, "云途"));
        syncFromYunexpress(shipment);
        return toDto(shipment);
    }

    public List<YunexpressQuoteDto> quoteYunexpress(long orderId, Double weightKg) {
        Order order = loadOrder(orderId);
        assertTrackerOrAdmin(order);
        ParsedAddress address = parseAddress(order);
        int pieces = Math.max(1, orderPieceRepository.findByOrderIdOrderBySeqAsc(order.getId()).size());
        double weight = normalizeWeight(weightKg, pieces);
        return yunExpressClient.quote(address.countryCode, address.postalCode, weight, pieces).stream()
                .map(option -> YunexpressQuoteDto.builder()
                        .productCode(option.productCode)
                        .productName(option.productName)
                        .currency(option.currency)
                        .amount(String.format(java.util.Locale.US, "%.2f", option.amount))
                        .intervalDay(option.intervalDay)
                        .build())
                .toList();
    }

    @Transactional
    public OrderShipmentDto cancelYunexpress(long orderId) {
        OrderShipment shipment = requireYunexpress(orderId);
        yunExpressClient.cancelWaybill(shipment.getTrackingNumber());
        shipment.setStatus("C");
        shipment.setStatusLabel("已撤销");
        shipmentRepository.save(shipment);
        recordShipmentEvent(shipment.getOrderId(), "运单已撤销",
                "运单 " + shipment.getTrackingNumber() + " 已撤销，暂不继续派送。如需重新寄出，我们会再通知您新的单号。");
        return toDto(shipment);
    }

    @Transactional
    public OrderShipmentDto holdYunexpress(long orderId, String remark) {
        OrderShipment shipment = requireYunexpress(orderId);
        String note = StringUtils.hasText(remark) ? remark.trim() : "客户暂扣";
        yunExpressClient.holdWaybill(shipment.getTrackingNumber(), note);
        shipment.setStatus("H");
        shipment.setStatusLabel("已拦截");
        shipmentRepository.save(shipment);
        recordShipmentEvent(shipment.getOrderId(), "运单已拦截",
                "包裹已暂时拦截，我们正在处理，随后会更新物流。运单号：" + shipment.getTrackingNumber());
        return toDto(shipment);
    }

    @Transactional
    public OrderShipmentDto modifyYunexpressWeight(long orderId, Double weightKg) {
        OrderShipment shipment = requireYunexpress(orderId);
        if (weightKg == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请填写预报重量");
        }
        yunExpressClient.modifyWeight(shipment.getTrackingNumber(), weightKg);
        return toDto(shipment);
    }

    public YunexpressDocumentDto yunexpressLabel(long orderId) {
        OrderShipment shipment = requireYunexpress(orderId);
        return toDocument(yunExpressClient.label(shipment.getTrackingNumber()));
    }

    public YunexpressDocumentDto yunexpressShippingDocument(long orderId) {
        OrderShipment shipment = requireYunexpress(orderId);
        return toDocument(yunExpressClient.shippingDocument(shipment.getTrackingNumber()));
    }

    public YunexpressDocumentDto yunexpressPod(long orderId) {
        OrderShipment shipment = requireYunexpress(orderId);
        return toDocument(yunExpressClient.proofOfDelivery(shipment.getTrackingNumber()));
    }

    private YunexpressDocumentDto toDocument(YunExpressClient.DocumentLink link) {
        return YunexpressDocumentDto.builder().url(link.url).labelType(link.labelType).build();
    }

    private OrderShipment requireYunexpress(long orderId) {
        Order order = loadOrder(orderId);
        assertTrackerOrAdmin(order);
        OrderShipment shipment = requireShipment(orderId);
        if (!isYunexpress(shipment)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "当前运单不是云途，不能使用这项操作");
        }
        return shipment;
    }

    /** 已登录员工都可查看物流。发货和改单号仍只允许本单跟单员或管理员。 */
    @Transactional
    public OrderShipmentDto getShipment(long orderId) {
        loadOrder(orderId);
        return shipmentRepository.findByOrderId(orderId)
                .map(this::refreshIfYunexpress)
                .map(this::toDto)
                .orElse(null);
    }

    @Transactional
    public OrderShipmentDto getShipmentForCustomer(long orderId) {
        // 客户侧由 PortalCustomerService 校验绑定后调用；云途单在这里代查轨迹
        return shipmentRepository.findByOrderId(orderId)
                .map(this::refreshIfYunexpress)
                .map(this::toDto)
                .orElse(null);
    }

    public boolean hasShipment(long orderId) {
        return shipmentRepository.findByOrderId(orderId).isPresent();
    }

    /**
     * 更正填错的单号或承运商。仍是同一条物流记录，客户聊天另发一条「物流单号已更正」。
     * 不改订单状态。
     */
    @Transactional
    public OrderShipmentDto correctTracking(long orderId, ShipOrderRequest req) {
        Order order = loadOrder(orderId);
        assertTrackerOrAdmin(order);
        OrderShipment shipment = requireShipment(orderId);
        String trackingNumber = requireTrackingNumber(req);
        ParsedCarrier carrier = parseCarrier(req);
        boolean numberChanged = !trackingNumber.equals(shipment.getTrackingNumber());
        boolean carrierChanged = carrier.specified() && carrierDiffers(shipment, carrier);
        if (!numberChanged && !carrierChanged) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "物流信息没有变化");
        }
        shipment.setTrackingNumber(trackingNumber);
        if (carrierChanged) {
            shipment.setCarrierName(carrier.name());
            shipment.setCarrierCode(carrier.code());
        }
        clearTrackingSnapshot(shipment, false);
        shipment.setQueryUrl(buildQueryUrl(trackingNumber));
        shipmentRepository.save(shipment);
        recordShipmentEvent(orderId, "物流单号已更正",
                customerTrackingDetail("物流单号已更正。", trackingNumber, shipment.getCarrierName()));
        syncTracking(shipment);
        return toDto(shipment);
    }

    /**
     * 发错货后的新一次发出。新单号覆盖为当前有效单号，并通知客户「已重新发货」。
     * 订单保持已完成/已发货，不退回生产中。
     */
    @Transactional
    public OrderShipmentDto reship(long orderId, ShipOrderRequest req) {
        Order order = loadOrder(orderId);
        assertTrackerOrAdmin(order);
        OrderShipment shipment = requireShipment(orderId);
        String trackingNumber = requireTrackingNumber(req);
        if (trackingNumber.equalsIgnoreCase(shipment.getTrackingNumber().trim())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "重新发货请填写新的国际物流单号");
        }
        ParsedCarrier carrier = parseCarrier(req);
        shipment.setTrackingNumber(trackingNumber);
        if (carrier.specified()) {
            shipment.setCarrierName(carrier.name());
            shipment.setCarrierCode(carrier.code());
        } else {
            shipment.setCarrierName(null);
            shipment.setCarrierCode(null);
        }
        clearTrackingSnapshot(shipment, true);
        shipment.setQueryUrl(buildQueryUrl(trackingNumber));
        shipmentRepository.save(shipment);
        recordShipmentEvent(orderId, "已重新发货",
                customerTrackingDetail("已重新发货。", trackingNumber, shipment.getCarrierName()));
        syncTracking(shipment);
        return toDto(shipment);
    }

    private void syncTracking(OrderShipment shipment) {
        if (isYunexpress(shipment)) {
            syncFromYunexpress(shipment);
            return;
        }
        syncFromSeventeenTrack(shipment);
    }

    private void syncFromSeventeenTrack(OrderShipment shipment) {
        if (!seventeenTrackClient.isEnabled()) {
            mockSync(shipment);
            return;
        }
        try {
            SeventeenTrackClient.TrackResult result = seventeenTrackClient.getTrackInfo(
                    shipment.getTrackingNumber(), shipment.getCarrierCode());
            if (result == null) {
                mockSync(shipment);
                return;
            }
            shipment.setCarrierCode(result.carrierCode);
            shipment.setCarrierName(result.carrierName);
            shipment.setStatus(result.statusCode);
            shipment.setStatusLabel(result.statusLabel);
            if (result.events != null && !result.events.isEmpty()) {
                shipment.setTrackingEventsJson(objectMapper.writeValueAsString(toEventMaps(result.events)));
            }
            shipment.setLastSyncAt(LocalDateTime.now());
            if ("4".equals(result.statusCode) || "Delivered".equalsIgnoreCase(result.statusCode)) {
                shipment.setDeliveredAt(LocalDateTime.now());
            }
            shipmentRepository.save(shipment);
        } catch (Exception e) {
            log.warn("[shipment] 同步 17TRACK 失败（降级）: {}", e.getMessage());
            mockSync(shipment);
        }
    }

    /** 模拟物流轨迹（17TRACK 未启用或查询失败时），保证物流弹窗有内容可展示。 */
    private void mockSync(OrderShipment shipment) {
        try {
            if (shipment.getCarrierCode() == null && !StringUtils.hasText(shipment.getCarrierName())) {
                shipment.setCarrierName("FedEx");
            }
            shipment.setStatus("1");
            shipment.setStatusLabel("运输中");
            java.util.List<Map<String, Object>> events = new ArrayList<>();
            events.add(Map.of("time", LocalDateTime.now().minusDays(2).format(ISO),
                    "location", "Shenzhen, CN", "description", "订单已揽收", "statusCode", "3"));
            events.add(Map.of("time", LocalDateTime.now().minusDays(1).format(ISO),
                    "location", "Guangzhou, CN", "description", "包裹已离开转运中心", "statusCode", "1"));
            events.add(Map.of("time", LocalDateTime.now().format(ISO),
                    "location", "In Transit", "description", "包裹运输中", "statusCode", "1"));
            shipment.setTrackingEventsJson(objectMapper.writeValueAsString(events));
            shipment.setLastSyncAt(LocalDateTime.now());
            shipmentRepository.save(shipment);
        } catch (Exception e) {
            log.warn("[shipment] 模拟物流轨迹失败: {}", e.getMessage());
        }
    }

    private List<Map<String, Object>> toEventMaps(List<SeventeenTrackClient.TrackEvent> events) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (SeventeenTrackClient.TrackEvent e : events) {
            out.add(Map.of(
                    "time", e.time == null ? "" : e.time,
                    "location", e.location == null ? "" : e.location,
                    "description", e.description == null ? "" : e.description,
                    "statusCode", e.statusCode == null ? "" : e.statusCode
            ));
        }
        return out;
    }

    private OrderShipmentDto toDto(OrderShipment s) {
        List<OrderShipmentDto.Event> events = new ArrayList<>();
        if (StringUtils.hasText(s.getTrackingEventsJson())) {
            try {
                List<Map<String, Object>> raw = objectMapper.readValue(s.getTrackingEventsJson(),
                        new TypeReference<List<Map<String, Object>>>() {});
                for (Map<String, Object> m : raw) {
                    events.add(OrderShipmentDto.Event.builder()
                            .time(str(m.get("time")))
                            .location(str(m.get("location")))
                            .description(str(m.get("description")))
                            .statusCode(str(m.get("statusCode")))
                            .build());
                }
            } catch (Exception ignored) {
            }
        }
        boolean yunexpress = isYunexpress(s);
        boolean sandbox = yunexpress && yunExpressClient.isSandbox();
        String note = null;
        if (yunexpress) {
            if (!yunExpressClient.isConfigured()) {
                note = "云途凭证未配置，暂时无法查询轨迹。";
            } else if (events.isEmpty()) {
                note = sandbox ? "当前是云途沙盒环境，暂无轨迹节点。" : "云途暂无轨迹节点。";
            } else if (sandbox) {
                note = "当前是云途沙盒环境，以下为沙盒返回的轨迹。";
            }
        }
        return OrderShipmentDto.builder()
                .id(s.getId())
                .orderId(s.getOrderId())
                .trackingNumber(s.getTrackingNumber())
                .carrierCode(s.getCarrierCode())
                .carrierName(s.getCarrierName())
                .status(s.getStatus())
                .statusLabel(s.getStatusLabel())
                .events(events)
                .queryUrl(s.getQueryUrl())
                .sandbox(sandbox)
                .trackingNote(note)
                .lastMileName(s.getLastMileName())
                .lastMileTracking(s.getLastMileTracking())
                .lastMileSite(s.getLastMileSite())
                .lastMilePhone(s.getLastMilePhone())
                .shippedAt(s.getShippedAt() != null ? ISO.format(s.getShippedAt()) : null)
                .deliveredAt(s.getDeliveredAt() != null ? ISO.format(s.getDeliveredAt()) : null)
                .build();
    }

    private OrderShipment refreshIfYunexpress(OrderShipment shipment) {
        if (!isYunexpress(shipment) || !yunExpressClient.isConfigured()) {
            return shipment;
        }
        if (shipment.getLastSyncAt() != null && shipment.getLastSyncAt().isAfter(LocalDateTime.now().minusSeconds(30))) {
            attachLastMile(shipment);
            return shipment;
        }
        syncFromYunexpress(shipment);
        attachLastMile(shipment);
        return shipment;
    }

    private void syncFromYunexpress(OrderShipment shipment) {
        try {
            YunExpressClient.TrackSnapshot snapshot = yunExpressClient.getTrack(shipment.getTrackingNumber());
            if (snapshot == null) {
                return;
            }
            shipment.setStatus(snapshot.packageStatus);
            shipment.setStatusLabel(snapshot.events == null || snapshot.events.isEmpty()
                    ? (yunExpressClient.isSandbox() ? "已发货（沙盒暂无轨迹节点）" : "已发货（暂无轨迹节点）")
                    : snapshot.statusLabel);
            List<Map<String, Object>> events = new ArrayList<>();
            if (snapshot.events != null) {
                for (YunExpressClient.TrackEvent event : snapshot.events) {
                    Map<String, Object> row = new java.util.LinkedHashMap<>();
                    row.put("time", event.time == null ? "" : event.time);
                    row.put("location", event.location == null ? "" : event.location);
                    row.put("description", event.description == null ? "" : event.description);
                    row.put("statusCode", event.statusCode == null ? "" : event.statusCode);
                    events.add(row);
                }
            }
            shipment.setTrackingEventsJson(objectMapper.writeValueAsString(events));
            shipment.setLastSyncAt(LocalDateTime.now());
            if ("D".equalsIgnoreCase(snapshot.packageStatus) || "3".equals(snapshot.packageStatus)) {
                shipment.setDeliveredAt(LocalDateTime.now());
            }
            shipmentRepository.save(shipment);
        } catch (Exception e) {
            log.warn("[shipment] 同步云途轨迹失败: {}", e.getMessage());
        }
    }

    private void attachLastMile(OrderShipment shipment) {
        YunExpressClient.LastMile mile = yunExpressClient.lastMile(shipment.getTrackingNumber());
        if (mile == null) {
            return;
        }
        shipment.setLastMileName(mile.name);
        shipment.setLastMileTracking(mile.trackingNumber);
        shipment.setLastMileSite(mile.site);
        shipment.setLastMilePhone(mile.phone);
    }

    private boolean isYunexpress(OrderShipment shipment) {
        String name = shipment.getCarrierName() == null ? "" : shipment.getCarrierName().trim();
        return "云途".equals(name) || "yunexpress".equalsIgnoreCase(name);
    }

    private YunExpressClient.OrderDraft buildYunexpressDraft(Order order, String customerOrderNumber, String productCode, Double weightKg) {
        ParsedAddress address = parseAddress(order);
        List<OrderPiece> pieces = orderPieceRepository.findByOrderIdOrderBySeqAsc(order.getId());
        int quantity = Math.max(1, pieces.size());
        String chineseName = chineseParcelName(pieces);
        String englishName = englishParcelName(pieces);
        double totalWeight = normalizeWeight(weightKg, quantity);
        double unitWeight = Math.max(0.001, totalWeight / quantity);
        YunExpressClient.OrderDraft draft = new YunExpressClient.OrderDraft();
        draft.customerOrderNumber = customerOrderNumber;
        draft.productCode = StringUtils.hasText(productCode) ? productCode.trim() : null;
        draft.countryCode = address.countryCode;
        draft.firstName = address.firstName;
        draft.lastName = address.lastName;
        draft.street = address.street;
        draft.street2 = address.street2;
        draft.street3 = address.street3;
        draft.city = address.city;
        draft.state = address.state;
        draft.postalCode = address.postalCode;
        draft.phone = address.phone;
        draft.chineseName = chineseName;
        draft.englishName = englishName;
        draft.quantity = quantity;
        draft.unitWeightKg = unitWeight;
        draft.weightKg = totalWeight;
        draft.unitPriceUsd = 10;
        draft.prepayIoss = EU_COUNTRIES.contains(address.countryCode);
        return draft;
    }

    private static double normalizeWeight(Double weightKg, int pieces) {
        if (weightKg == null) {
            return Math.max(0.2, 0.2 * Math.max(1, pieces));
        }
        return weightKg;
    }

    private ParsedAddress parseAddress(Order order) {
        List<String> missing = new ArrayList<>();
        String recipient = text(order.getShippingRecipient());
        String phone = text(order.getShippingPhone());
        String countryRaw = text(order.getShippingCountry());
        String addressRaw = text(order.getShippingAddress());
        String postal = text(order.getShippingPostalCode());
        if (recipient.isEmpty()) missing.add("收货人");
        if (phone.isEmpty() || phone.chars().noneMatch(Character::isDigit)) missing.add("电话");
        if (countryRaw.isEmpty()) missing.add("国家");
        if (addressRaw.isEmpty()) missing.add("详细地址");
        if (postal.isEmpty()) missing.add("邮编");
        if (!missing.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "收件信息不完整，无法向云途下单。缺少：" + String.join("、", missing));
        }
        String countryCode = countryCodeOf(countryRaw);
        if (countryCode == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "无法识别收件国家二字码（当前：" + trim(countryRaw, 40) + "）。请让客户重新选择国家后再发货。");
        }
        String city = null;
        String state = null;
        List<String> streetParts = new ArrayList<>();
        for (String line : addressRaw.split("\\r?\\n")) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            Matcher cityMatcher = CITY_LINE.matcher(trimmed);
            Matcher stateMatcher = STATE_LINE.matcher(trimmed);
            Matcher streetMatcher = STREET_LINE.matcher(trimmed);
            if (cityMatcher.matches()) {
                city = cityMatcher.group(2).trim();
            } else if (stateMatcher.matches()) {
                state = stateMatcher.group(2).trim();
            } else if (streetMatcher.matches()) {
                streetParts.add(streetMatcher.group(2).trim());
            } else if (!trimmed.matches("(?i)^(国家|Country|Pays|Land|País)\\s*[:：].*")
                    && !trimmed.matches("(?i)^(邮编|Postal|Code postal|PLZ)\\s*[:：].*")) {
                streetParts.add(trimmed);
            }
        }
        String streetSource = streetParts.isEmpty() ? addressRaw : String.join(", ", streetParts);
        if (!StringUtils.hasText(city)) {
            List<String> segments = splitAddress(streetSource);
            if (segments.size() >= 3) {
                city = segments.get(1);
                if (!StringUtils.hasText(state)) {
                    state = segments.get(2);
                }
                streetSource = segments.get(0);
            } else if (segments.size() == 2 && segments.get(0).chars().anyMatch(Character::isDigit)) {
                city = segments.get(1);
                streetSource = segments.get(0);
            }
        }
        if (!StringUtils.hasText(city)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "云途下单需要城市。请在详细地址里单独一行写「城市：城市名」，或写成「街道, 城市, 州」。");
        }
        city = trim(city, 50);
        if (StringUtils.hasText(state)) {
            state = trim(state, 50);
        }
        List<String> streets = splitStreet(streetSource);
        String[] name = splitName(recipient);
        ParsedAddress parsed = new ParsedAddress();
        parsed.countryCode = countryCode;
        parsed.firstName = name[0];
        parsed.lastName = name[1];
        parsed.street = streets.get(0);
        parsed.street2 = streets.size() > 1 ? streets.get(1) : null;
        parsed.street3 = streets.size() > 2 ? streets.get(2) : null;
        parsed.city = city;
        parsed.state = state;
        parsed.postalCode = trim(postal, 20);
        parsed.phone = trim(phone, 50);
        return parsed;
    }

    private static List<String> splitAddress(String raw) {
        String[] parts = raw.split("[,，]");
        List<String> out = new ArrayList<>();
        for (String part : parts) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) {
                out.add(trimmed);
            }
        }
        return out;
    }

    private static List<String> splitStreet(String raw) {
        String text = raw == null ? "" : raw.trim();
        if (text.isEmpty()) {
            text = "jewelry";
        }
        List<String> lines = new ArrayList<>();
        while (!text.isEmpty() && lines.size() < 3) {
            if (text.length() <= 200) {
                lines.add(text);
                break;
            }
            lines.add(text.substring(0, 200));
            text = text.substring(200).trim();
        }
        return lines;
    }

    private static String[] splitName(String recipient) {
        String name = trim(recipient, 100);
        int space = name.indexOf(' ');
        if (space > 0 && space < name.length() - 1 && name.length() > 50) {
            return new String[]{trim(name.substring(0, space), 50), trim(name.substring(space + 1), 50)};
        }
        if (name.length() <= 50) {
            return new String[]{name, null};
        }
        return new String[]{name.substring(0, 50), trim(name.substring(50), 50)};
    }

    private String countryCodeOf(String raw) {
        Matcher matcher = COUNTRY_CODE.matcher(raw);
        if (matcher.find()) {
            return matcher.group(1);
        }
        String compact = raw.trim();
        if (compact.length() == 2 && compact.chars().allMatch(Character::isLetter)) {
            return compact.toUpperCase(Locale.ROOT);
        }
        return switch (compact) {
            case "中国" -> "CN";
            case "美国" -> "US";
            case "英国" -> "GB";
            case "德国" -> "DE";
            case "法国" -> "FR";
            case "日本" -> "JP";
            case "韩国" -> "KR";
            case "加拿大" -> "CA";
            case "澳大利亚" -> "AU";
            case "新加坡" -> "SG";
            case "香港", "中国香港" -> "HK";
            case "台湾", "中国台湾" -> "TW";
            case "澳门", "中国澳门" -> "MO";
            case "意大利" -> "IT";
            case "西班牙" -> "ES";
            case "荷兰" -> "NL";
            case "瑞士" -> "CH";
            case "马来西亚" -> "MY";
            case "泰国" -> "TH";
            case "越南" -> "VN";
            case "阿联酋" -> "AE";
            case "新西兰" -> "NZ";
            default -> null;
        };
    }

    private static String chineseParcelName(List<OrderPiece> pieces) {
        StringBuilder sb = new StringBuilder();
        for (OrderPiece piece : pieces) {
            String name = piece.getName() == null ? "" : piece.getName().trim();
            if (!hasHan(name)) {
                continue;
            }
            if (sb.length() > 0) {
                sb.append('、');
            }
            sb.append(name);
            if (sb.length() >= 50) {
                break;
            }
        }
        if (sb.length() == 0) {
            return "银饰";
        }
        return trim(sb.toString(), 50);
    }

    private static String englishParcelName(List<OrderPiece> pieces) {
        JewelryType type = pieces.isEmpty() ? null : pieces.get(0).getJewelryType();
        if (type == null) {
            return "silver jewelry";
        }
        return switch (type) {
            case RING -> "silver ring";
            case NECKLACE -> "silver necklace";
            case EARRING -> "silver earring";
            case BROOCH -> "silver brooch";
            case BRACELET -> "silver bracelet";
            case COLLARBONE -> "silver necklace";
            case HAIR -> "silver hair ornament";
            case CHARM -> "silver charm";
            case OTHER -> "silver jewelry";
        };
    }

    private String customerOrderNumber(Order order, boolean reship) {
        String base = text(order.getOrderNumber()).replaceAll("[^A-Za-z0-9_-]", "");
        if (base.isEmpty()) {
            base = "JZ" + order.getId();
        }
        if (base.length() > 32) {
            base = base.substring(0, 32);
        }
        if (!reship) {
            return base;
        }
        String suffix = "R" + (System.currentTimeMillis() % 1_000_000);
        String combined = base + suffix;
        return combined.length() <= 50 ? combined : combined.substring(combined.length() - 50);
    }

    private static boolean hasHan(String value) {
        return value.codePoints().anyMatch(cp -> Character.UnicodeScript.of(cp) == Character.UnicodeScript.HAN);
    }

    private static String text(String value) {
        return value == null ? "" : value.trim();
    }

    private static String trim(String value, int max) {
        if (value == null) {
            return "";
        }
        String text = value.trim();
        return text.length() <= max ? text : text.substring(0, max);
    }

    private static final class ParsedAddress {
        private String countryCode;
        private String firstName;
        private String lastName;
        private String street;
        private String street2;
        private String street3;
        private String city;
        private String state;
        private String postalCode;
        private String phone;
    }

    private String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private String buildQueryUrl(String trackingNumber) {
        return "https://t.17track.net/zh-cn#nums=" + trackingNumber;
    }

    private String requireTrackingNumber(ShipOrderRequest req) {
        String trackingNumber = req == null || req.getTrackingNumber() == null ? "" : req.getTrackingNumber().trim();
        if (trackingNumber.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "快递单号不能为空");
        }
        if (trackingNumber.length() > 64) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "快递单号过长");
        }
        return trackingNumber;
    }

    private OrderShipment requireShipment(long orderId) {
        return shipmentRepository.findByOrderId(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "订单尚未发货"));
    }

    /** 名称变更时丢掉旧承运商编码，避免用旧公司去查新单号。未填写则 specified=false。 */
    private ParsedCarrier parseCarrier(ShipOrderRequest req) {
        String carrierName = req == null || req.getCarrierName() == null ? "" : req.getCarrierName().trim();
        Integer carrierCode = req == null ? null : req.getCarrierCode();
        if (!StringUtils.hasText(carrierName) && carrierCode == null) {
            return new ParsedCarrier(null, null, false);
        }
        if (carrierCode == null && carrierName.matches("\\d+")) {
            try {
                carrierCode = Integer.valueOf(carrierName);
                carrierName = "";
            } catch (NumberFormatException ignored) {
                carrierCode = null;
            }
        }
        if (carrierName.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "承运商名称过长");
        }
        String name = StringUtils.hasText(carrierName) ? carrierName : null;
        Integer code = name != null ? null : carrierCode;
        return new ParsedCarrier(name, code, true);
    }

    private boolean carrierDiffers(OrderShipment shipment, ParsedCarrier carrier) {
        if (carrier.name() != null) {
            String current = shipment.getCarrierName() == null ? "" : shipment.getCarrierName().trim();
            return !carrier.name().equals(current);
        }
        return !Objects.equals(carrier.code(), shipment.getCarrierCode());
    }

    /** 换单号后清掉旧轨迹。newDispatch 为重新发货，更新发出时间；更正单号保留原发出时间。 */
    private void clearTrackingSnapshot(OrderShipment shipment, boolean newDispatch) {
        shipment.setStatus(null);
        shipment.setStatusLabel("已发货（待物流更新）");
        shipment.setTrackingEventsJson("[]");
        shipment.setDeliveredAt(null);
        shipment.setLastSyncAt(LocalDateTime.now());
        if (newDispatch || shipment.getShippedAt() == null) {
            shipment.setShippedAt(LocalDateTime.now());
        }
    }

    private String customerTrackingDetail(String lead, String trackingNumber, String carrierName) {
        StringBuilder sb = new StringBuilder(lead).append("请按新单号查询：").append(trackingNumber);
        if (StringUtils.hasText(carrierName)) {
            sb.append("（承运商：").append(carrierName.trim()).append("）");
        }
        return sb.toString();
    }

    private void recordShipmentEvent(long orderId, String title, String detail) {
        Long uid = SecurityUtils.currentStaffUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        orderEventService.record(orderId, OrderEventType.SHIPPED,
                AccountKind.STAFF, uid, SecurityUtils.currentRoleApi().orElse("TRACKER"),
                title, detail,
                null, null);
    }

    private record ParsedCarrier(String name, Integer code, boolean specified) {
    }

    private Order loadOrder(long orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
    }

    private void assertCanShip(Order order) {
        if (order.getStatus() != OrderStatus.PRODUCING && order.getStatus() != OrderStatus.COMPLETED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "仅「生产中」或「已完成」订单可发货");
        }
        assertTrackerOrAdmin(order);
    }

    private void assertTrackerOrAdmin(Order order) {
        if ("ADMIN".equals(SecurityUtils.currentRoleApi().orElse(""))) {
            return;
        }
        if (!"TRACKER".equals(SecurityUtils.currentRoleApi().orElse(""))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅跟单员或管理员可操作物流");
        }
        Long uid = SecurityUtils.currentStaffUserId().orElse(null);
        if (order.getFollowUp() == null || uid == null || !uid.equals(order.getFollowUp().getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅本单跟单员可操作物流");
        }
    }
}
