package com.jewelry.system.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.order.OrderEventDto;
import com.jewelry.system.entity.DesignInfo;
import com.jewelry.system.entity.ModelingInfo;
import com.jewelry.system.entity.OrderEvent;
import com.jewelry.system.entity.User;
import com.jewelry.system.enums.OrderEventType;
import com.jewelry.system.repository.B2BClientRepository;
import com.jewelry.system.repository.DesignInfoRepository;
import com.jewelry.system.repository.ModelingInfoRepository;
import com.jewelry.system.repository.OrderEventRepository;
import com.jewelry.system.repository.PortalCustomerAccountRepository;
import com.jewelry.system.repository.UserRepository;
import com.jewelry.system.security.AccountKind;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

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
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public OrderEventDto assemble(OrderEvent event) {
        List<String> images = resolveImages(event);
        if (images == null || images.isEmpty()) {
            images = List.of(placeholderImage(event.getEventType()));
        }
        String resolution = resolveResolution(event);
        String resolutionLabel = resolutionLabel(resolution);
        boolean actionable = (event.getEventType() == OrderEventType.DESIGN_SUBMIT
                || event.getEventType() == OrderEventType.MODEL_SUBMIT
                || event.getEventType() == OrderEventType.BALANCE_PAYMENT)
                && resolution == null;
        return OrderEventDto.builder()
                .id(event.getId())
                .orderId(event.getOrderId())
                .eventType(event.getEventType().name())
                .actorType(event.getActorType() != null ? event.getActorType().name() : null)
                .actorId(event.getActorId())
                .actorRole(event.getActorRole())
                .actorName(resolveActorName(event.getActorType(), event.getActorId()))
                .title(event.getTitle())
                .content(event.getContent())
                .reason(event.getReason())
                .fileIds(parseLongList(event.getFileIdsJson()))
                .images(images)
                .actionable(actionable)
                .resolution(resolution)
                .resolutionLabel(resolutionLabel)
                .createdAt(event.getCreatedAt())
                .build();
    }

    /** 判断客户对该提交事件已作出的决策：CONFIRM / REJECT / PAID / null。 */
    private String resolveResolution(OrderEvent event) {
        OrderEventType type = event.getEventType();
        if (type == null) {
            return null;
        }
        List<OrderEventType> followers = switch (type) {
            case DESIGN_SUBMIT -> List.of(OrderEventType.DESIGN_CONFIRM, OrderEventType.DESIGN_REJECT);
            case MODEL_SUBMIT -> List.of(OrderEventType.MODEL_CONFIRM, OrderEventType.MODEL_REJECT);
            case BALANCE_PAYMENT -> List.of(OrderEventType.BALANCE_PAID);
            default -> List.of();
        };
        if (followers.isEmpty()) {
            return null;
        }
        List<OrderEvent> later = orderEventRepository.findByOrderIdOrderByIdAsc(event.getOrderId());
        for (OrderEvent e : later) {
            if (e.getId() <= event.getId()) {
                continue;
            }
            if (followers.contains(e.getEventType())) {
                return switch (e.getEventType()) {
                    case DESIGN_CONFIRM, MODEL_CONFIRM -> "CONFIRM";
                    case DESIGN_REJECT, MODEL_REJECT -> "REJECT";
                    case BALANCE_PAID -> "PAID";
                    default -> null;
                };
            }
        }
        return null;
    }

    private static String resolutionLabel(String resolution) {
        if (resolution == null) {
            return null;
        }
        return switch (resolution) {
            case "CONFIRM" -> "已确认";
            case "REJECT" -> "已驳回";
            case "PAID" -> "已支付";
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

    private String resolveActorName(AccountKind type, Long accountId) {
        try {
            return switch (type) {
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
        } catch (Exception e) {
            log.warn("解析事件操作者姓名失败 type={} id={}", type, accountId, e);
            return null;
        }
    }

    private List<String> resolveImages(OrderEvent event) {
        OrderEventType type = event.getEventType();
        if (type == null) {
            return List.of();
        }
        try {
            switch (type) {
                case DESIGN_SUBMIT, DESIGN_REJECT, DESIGN_CONFIRM -> {
                    DesignInfo di = designInfoRepository.findByOrderId(event.getOrderId()).orElse(null);
                    return parseStringList(di != null ? di.getDesignImagesJson() : null);
                }
                case MODEL_SUBMIT, MODEL_REJECT, MODEL_CONFIRM -> {
                    ModelingInfo mi = modelingInfoRepository.findByOrderId(event.getOrderId()).orElse(null);
                    return parseStringList(mi != null ? mi.getModelEffectImagesJson() : null);
                }
                case STATUS_CHANGE -> {
                    // 来图定制/设计师设计的订单创建事件：展示客户上传的参考图/灵感图
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
}
