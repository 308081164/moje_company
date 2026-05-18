package com.jewelry.system.service;

import com.jewelry.system.dto.b2b.B2BLastOrderProfileDto;
import com.jewelry.system.dto.b2b.B2BOrderAccessDto;
import com.jewelry.system.dto.b2b.B2BOrderCreateRequest;
import com.jewelry.system.dto.order.FileInfoDto;
import com.jewelry.system.dto.order.OrderInfoDto;
import com.jewelry.system.entity.B2BClient;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.OrderAccessLink;
import com.jewelry.system.entity.OrderCustomerViewLink;
import com.jewelry.system.enums.OrderSource;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.repository.*;
import com.jewelry.system.util.B2BPortalOrderStatus;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class B2BOrderService {

    private final OrderRepository orderRepository;
    private final B2BClientRepository clientRepository;
    private final OrderAccessLinkRepository accessLinkRepository;
    private final OrderCustomerViewLinkRepository orderCustomerViewLinkRepository;
    private final OrderAccessLinkService linkService;
    private final EmailNotificationService emailNotificationService;
    private final OrderQueryService orderQueryService;
    private final AutoAssignmentService autoAssignmentService;
    private final WeComCustomerGroupService weComCustomerGroupService;
    private final OrderFileService orderFileService;

    private static final DateTimeFormatter DAY = DateTimeFormatter.BASIC_ISO_DATE;

    @Transactional
    public B2BOrderAccessDto createOrder(B2BOrderCreateRequest req) {
        if (!StringUtils.hasText(req.getBasicRequirements())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请填写订单基础需求");
        }
        Long clientId = SecurityUtils.currentB2bClientId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录 B 端账号后再创建订单"));
        B2BClient client = clientRepository.findById(clientId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "客户账号无效"));

        boolean clientDirty = false;
        if (StringUtils.hasText(req.getCompanyName())) {
            client.setCompanyName(req.getCompanyName().trim());
            clientDirty = true;
        }
        if (StringUtils.hasText(req.getContactPerson())) {
            client.setContactPerson(req.getContactPerson().trim());
            clientDirty = true;
        }
        if (clientDirty) {
            clientRepository.save(client);
        }

        Order order = new Order();
        order.setIsB2b(true);
        order.setSource(OrderSource.B2B);
        order.setB2bClient(client);
        order.setInfluencerName(null);
        order.setDeposit(BigDecimal.ZERO);
        order.setBasicRequirements(req.getBasicRequirements());
        order.setStyleInfo(req.getStyleInfo());
        order.setMaterialInfo(req.getMaterialInfo());
        order.setCustomerName(resolveCustomerDisplayName(req, client));
        order.setCustomerPhone(client.getContact());
        order.setCustomerWechat(client.getContact());
        order.setOrderNumber(generateOrderNumber());
        order.setStatus(OrderStatus.PENDING_DESIGN);

        orderRepository.save(order);
        autoAssignmentService.autoAssignAll(order.getId());

        B2BOrderAccessDto accessDto = linkService.createLink(order.getId(), client.getId());

        emailNotificationService.sendOrderNotification(order.getOrderNumber(), client.getContact(), "B2B业务");

        Long oid = order.getId();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    weComCustomerGroupService.scheduleAfterOrderCreated(oid);
                }
            });
        } else {
            weComCustomerGroupService.scheduleAfterOrderCreated(oid);
        }

        return accessDto;
    }

    @Transactional(readOnly = true)
    public OrderInfoDto getOrderByToken(String token) {
        Order order = linkService.getOrderEntityByToken(token);
        OrderInfoDto dto = orderQueryService.getOrder(order.getId());
        accessLinkRepository.findByOrderId(order.getId()).ifPresent(link ->
                dto.setB2bShareAccessToken(link.getAccessToken()));
        enrichB2bPortalFields(dto, order);
        return dto;
    }

    @Transactional(readOnly = true)
    public List<OrderInfoDto> getClientOrders(String portalStatus, LocalDate from, LocalDate to) {
        Long clientId = SecurityUtils.currentB2bClientId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录"));
        String bucketFilter = StringUtils.hasText(portalStatus) ? portalStatus.trim().toUpperCase(Locale.ROOT) : null;

        return orderRepository.findByB2bClientIdOrderByCreatedAtDesc(clientId).stream()
                .filter(o -> from == null || !o.getCreatedAt().toLocalDate().isBefore(from))
                .filter(o -> to == null || !o.getCreatedAt().toLocalDate().isAfter(to))
                .map(o -> {
                    OrderInfoDto dto = orderQueryService.getOrder(o.getId());
                    accessLinkRepository.findByOrderId(o.getId()).ifPresent(link ->
                            dto.setB2bShareAccessToken(link.getAccessToken()));
                    enrichB2bPortalFields(dto, o);
                    return dto;
                })
                .filter(dto -> bucketFilter == null || bucketFilter.equals(dto.getB2bPortalStatusBucket()))
                .toList();
    }

    @Transactional(readOnly = true)
    public B2BLastOrderProfileDto getLastOrderDraftProfile() {
        Long clientId = SecurityUtils.currentB2bClientId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录"));
        B2BClient client = clientRepository.findById(clientId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "客户账号无效"));
        B2BLastOrderProfileDto.B2BLastOrderProfileDtoBuilder b = B2BLastOrderProfileDto.builder();
        if (StringUtils.hasText(client.getCompanyName())) {
            b.companyName(client.getCompanyName().trim());
        }
        if (StringUtils.hasText(client.getContactPerson())) {
            b.contactPerson(client.getContactPerson().trim());
        }
        orderRepository.findFirstByB2bClientIdOrderByCreatedAtDesc(clientId).ifPresent(o -> {
            if (StringUtils.hasText(o.getStyleInfo())) {
                b.styleInfo(o.getStyleInfo().trim());
            }
            if (StringUtils.hasText(o.getMaterialInfo())) {
                b.materialInfo(o.getMaterialInfo().trim());
            }
        });
        return b.build();
    }

    private void enrichB2bPortalFields(OrderInfoDto dto, Order entity) {
        OrderStatus st = entity.getStatus();
        dto.setB2bPortalStatusBucket(B2BPortalOrderStatus.bucket(st));
        dto.setB2bPortalStatusLabel(B2BPortalOrderStatus.labelZh(st));
        dto.setB2bAttachmentPreviewUrls(buildB2bAttachmentPreviewUrls(entity.getId()));
    }

    private List<String> buildB2bAttachmentPreviewUrls(long orderId) {
        List<FileInfoDto> files = orderFileService.listForOrder(orderId);
        return files.stream()
                .filter(f -> "DESIGN".equals(f.getFileType()) && isImageFileName(f.getFileName()))
                .sorted(Comparator
                        .comparing(FileInfoDto::getUploaderId, Comparator.nullsFirst(Comparator.naturalOrder()))
                        .thenComparing(FileInfoDto::getId))
                .map(FileInfoDto::getFileUrl)
                .filter(url -> url != null && !url.isBlank())
                .distinct()
                .limit(6)
                .toList();
    }

    private static boolean isImageFileName(String name) {
        if (name == null) {
            return false;
        }
        String n = name.toLowerCase(Locale.ROOT);
        return n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".png") || n.endsWith(".gif")
                || n.endsWith(".webp") || n.endsWith(".bmp");
    }

    @Transactional
    public void bindOrderWithProofForB2bClient(String orderNumber, String proofToken) {
        Long clientId = SecurityUtils.currentB2bClientId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录"));
        if (!StringUtils.hasText(orderNumber) || !StringUtils.hasText(proofToken)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "订单号与凭证不能为空");
        }
        Order order = orderRepository.findByOrderNumber(orderNumber.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
        if (!Boolean.TRUE.equals(order.getIsB2b()) && order.getSource() != OrderSource.B2B) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "仅支持 B 端业务订单绑定");
        }
        if (!proofMatchesOrder(proofToken.trim(), order.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "凭证与订单不匹配或已失效");
        }
        if (order.getB2bClient() != null && !order.getB2bClient().getId().equals(clientId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该订单已归属其他客户账号");
        }
        B2BClient client = clientRepository.findById(clientId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "客户账号无效"));
        order.setB2bClient(client);
        orderRepository.save(order);
        accessLinkRepository.findByOrderId(order.getId()).ifPresent(link -> {
            link.setB2bClientId(clientId);
            accessLinkRepository.save(link);
        });
    }

    private boolean proofMatchesOrder(String proofToken, long orderId) {
        return orderCustomerViewLinkRepository.findByViewToken(proofToken)
                .filter(l -> l.getOrderId().equals(orderId)
                        && OrderCustomerViewLink.LinkStatus.ACTIVE.equals(l.getStatus())
                        && (l.getExpireTime() == null || !l.getExpireTime().isBefore(LocalDateTime.now())))
                .isPresent()
                || accessLinkRepository.findByAccessToken(proofToken)
                .filter(l -> l.getOrderId().equals(orderId)
                        && OrderAccessLink.LinkStatus.ACTIVE.equals(l.getStatus())
                        && (l.getExpireTime() == null || !l.getExpireTime().isBefore(LocalDateTime.now())))
                .isPresent();
    }

    private String resolveCustomerDisplayName(B2BOrderCreateRequest req, B2BClient client) {
        if (StringUtils.hasText(req.getCompanyName())) {
            return req.getCompanyName().trim();
        }
        if (StringUtils.hasText(client.getCompanyName())) {
            return client.getCompanyName();
        }
        if (StringUtils.hasText(client.getContactPerson())) {
            return client.getContactPerson();
        }
        return client.getContact();
    }

    private String generateOrderNumber() {
        String prefix = "B2B" + LocalDate.now().format(DAY);
        long n = orderRepository.countByOrderNumberStartingWith(prefix);
        return prefix + String.format("%04d", n + 1);
    }
}
