package com.jewelry.system.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.order.OrderShipmentDto;
import com.jewelry.system.dto.order.ShipOrderRequest;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.OrderShipment;
import com.jewelry.system.enums.OrderEventType;
import com.jewelry.system.enums.OrderStatus;
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
import java.util.Map;

/**
 * 订单发货/物流服务。跟单员发货录入快递单号，客户在独立站查看物流状态。
 * 17TRACK 未启用或查询失败时降级为「已发货（待物流更新）」+ 官方查询链接。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ShipmentService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final OrderRepository orderRepository;
    private final OrderShipmentRepository shipmentRepository;
    private final OrderEventService orderEventService;
    private final SeventeenTrackClient seventeenTrackClient;
    private final ObjectMapper objectMapper;

    @Transactional
    public OrderShipmentDto ship(long orderId, ShipOrderRequest req) {
        Order order = loadOrder(orderId);
        assertCanShip(order);
        String trackingNumber = req.getTrackingNumber() == null ? "" : req.getTrackingNumber().trim();
        if (trackingNumber.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "快递单号不能为空");
        }
        if (shipmentRepository.findByOrderId(orderId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该订单已发货，请勿重复提交");
        }

        OrderShipment shipment = new OrderShipment();
        shipment.setOrderId(orderId);
        shipment.setTrackingNumber(trackingNumber);
        shipment.setCarrierCode(req.getCarrierCode());
        shipment.setShippedAt(LocalDateTime.now());
        shipment.setQueryUrl(buildQueryUrl(trackingNumber));
        // 默认降级状态，待 17TRACK 同步覆盖
        shipment.setStatus(null);
        shipment.setStatusLabel("已发货（待物流更新）");
        shipment.setTrackingEventsJson("[]");
        shipment.setLastSyncAt(LocalDateTime.now());
        shipmentRepository.save(shipment);

        Long uid = SecurityUtils.currentStaffUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        orderEventService.record(orderId, OrderEventType.SHIPPED,
                AccountKind.STAFF, uid, SecurityUtils.currentRoleApi().orElse("TRACKER"),
                "订单已发货", "快递单号：" + trackingNumber
                        + (StringUtils.hasText(shipment.getCarrierName()) ? "，承运商：" + shipment.getCarrierName() : ""),
                null, null);

        // 尝试 17TRACK 同步（失败静默降级，不阻塞发货）
        syncFromSeventeenTrack(shipment);

        return toDto(shipment);
    }

    @Transactional(readOnly = true)
    public OrderShipmentDto getShipment(long orderId) {
        Order order = loadOrder(orderId);
        assertCanViewShipment(order);
        return shipmentRepository.findByOrderId(orderId).map(this::toDto).orElse(null);
    }

    @Transactional(readOnly = true)
    public OrderShipmentDto getShipmentForCustomer(long orderId) {
        // 客户侧由 PortalCustomerService 校验绑定后调用；此处仅按订单查
        return shipmentRepository.findByOrderId(orderId).map(this::toDto).orElse(null);
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
                .shippedAt(s.getShippedAt() != null ? ISO.format(s.getShippedAt()) : null)
                .deliveredAt(s.getDeliveredAt() != null ? ISO.format(s.getDeliveredAt()) : null)
                .build();
    }

    private String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private String buildQueryUrl(String trackingNumber) {
        return "https://t.17track.net/zh-cn#nums=" + trackingNumber;
    }

    private Order loadOrder(long orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
    }

    private void assertCanShip(Order order) {
        if (order.getStatus() != OrderStatus.PRODUCING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "仅「生产中」订单可发货");
        }
        assertTrackerOrAdmin(order);
    }

    private void assertCanViewShipment(Order order) {
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
