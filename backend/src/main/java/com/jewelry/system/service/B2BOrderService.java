package com.jewelry.system.service;

import com.jewelry.system.dto.b2b.B2BOrderAccessDto;
import com.jewelry.system.dto.b2b.B2BOrderCreateRequest;
import com.jewelry.system.dto.order.OrderInfoDto;
import com.jewelry.system.entity.B2BClient;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.OrderAccessLink;
import com.jewelry.system.entity.OrderCustomerViewLink;
import com.jewelry.system.enums.OrderSource;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.repository.*;
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
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

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

        Order order = new Order();
        order.setIsB2b(true);
        order.setSource(OrderSource.B2B);
        order.setB2bClient(client);
        String sourceDetail = req.getSourceDetail();
        order.setInfluencerName(sourceDetail != null && !sourceDetail.isBlank() ? sourceDetail : null);
        order.setDeposit(req.getDepositAmount() != null ? BigDecimal.valueOf(req.getDepositAmount()) : BigDecimal.ZERO);
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

    public OrderInfoDto getOrderByToken(String token) {
        Order order = linkService.getOrderEntityByToken(token);
        return orderQueryService.getOrder(order.getId());
    }

    public List<OrderInfoDto> getClientOrders() {
        Long clientId = SecurityUtils.currentB2bClientId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录"));
        return orderRepository.findByB2bClientIdOrderByCreatedAtDesc(clientId).stream()
                .map(o -> {
                    OrderInfoDto dto = orderQueryService.getOrder(o.getId());
                    accessLinkRepository.findByOrderId(o.getId()).ifPresent(link ->
                            dto.setB2bShareAccessToken(link.getAccessToken()));
                    return dto;
                })
                .toList();
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

    private boolean proofMatchesOrder(String proofToken, Long orderId) {
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
