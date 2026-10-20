package com.jewelry.system.service;

import com.jewelry.system.dto.customer.CustomerOrderPublicDto;
import com.jewelry.system.dto.order.OrderEventDto;
import com.jewelry.system.dto.order.OrderShipmentDto;
import com.jewelry.system.dto.portal.*;
import com.jewelry.system.entity.*;
import com.jewelry.system.enums.OrderEventType;
import com.jewelry.system.repository.OrderAccessLinkRepository;
import com.jewelry.system.repository.OrderCustomerViewLinkRepository;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.DesignInfoRepository;
import com.jewelry.system.repository.ModelingInfoRepository;
import com.jewelry.system.repository.PortalCustomerAccountRepository;
import com.jewelry.system.repository.PortalCustomerOrderBindingRepository;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.enums.ServiceType;
import com.jewelry.system.security.AccountKind;
import com.jewelry.system.security.JwtTokenProvider;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PortalCustomerService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final PortalCustomerAccountRepository accountRepository;
    private final PortalCustomerOrderBindingRepository bindingRepository;
    private final OrderRepository orderRepository;
    private final OrderCustomerViewLinkRepository viewLinkRepository;
    private final OrderAccessLinkRepository accessLinkRepository;
    private final DesignInfoRepository designInfoRepository;
    private final ModelingInfoRepository modelingInfoRepository;
    private final CustomerOrderViewService customerOrderViewService;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final EmailVerificationService emailVerificationService;
    private final OrderEventService orderEventService;
    private final ShipmentService shipmentService;
    private final StorefrontService storefrontService;
    private final StorefrontWalletService storefrontWalletService;
    private final ReferralService referralService;
    private final OrderPieceService orderPieceService;
    private final OrderCommandService orderCommandService;

    @Transactional
    public PortalCustomerLoginResponse register(PortalCustomerRegisterRequest req) {
        validateContactPassword(req.getContact(), req.getPassword());
        if (accountRepository.existsByContact(req.getContact().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该联系方式已注册，请直接登录");
        }
        PortalCustomerAccount acc = new PortalCustomerAccount();
        acc.setContact(req.getContact().trim());
        acc.setPassword(passwordEncoder.encode(req.getPassword()));
        acc.setDisplayName(StringUtils.hasText(req.getDisplayName()) ? req.getDisplayName().trim() : null);
        acc = accountRepository.save(acc);

        if (StringUtils.hasText(req.getViewToken())) {
            tryBindViewToken(acc.getId(), req.getViewToken().trim());
        }
        return toLoginResponse(acc);
    }

    public PortalCustomerLoginResponse login(PortalCustomerLoginRequest req) {
        validateContactPassword(req.getContact(), req.getPassword());
        PortalCustomerAccount acc = accountRepository.findByContact(req.getContact().trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "联系方式或密码错误"));
        if (!passwordEncoder.matches(req.getPassword(), acc.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "联系方式或密码错误");
        }
        return toLoginResponse(acc);
    }

    @Transactional
    public PortalCustomerLoginResponse loginByEmailCode(PortalEmailLoginRequest req) {
        String email = normalizeEmail(req.getEmail());
        emailVerificationService.verifyAndConsume(email, req.getCode(), "LOGIN");
        PortalCustomerAccount acc = accountRepository.findByEmail(email).orElse(null);
        if (acc == null) {
            // 海外 C 端无密码注册：邮箱验证码即登录凭证，未注册时自动创建账号
            acc = createEmailAccount(email, null);
        }
        return toLoginResponse(acc);
    }

    @Transactional
    public PortalCustomerLoginResponse registerByEmailCode(PortalEmailRegisterRequest req) {
        String email = normalizeEmail(req.getEmail());
        emailVerificationService.verifyAndConsume(email, req.getCode(), "REGISTER");
        if (accountRepository.findByEmail(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该邮箱已注册，请直接登录");
        }
        PortalCustomerAccount acc = createEmailAccount(email, req.getDisplayName());
        return toLoginResponse(acc);
    }

    public void sendEmailCode(PortalEmailCodeRequest req) {
        emailVerificationService.sendCode(req.getEmail(), req.getPurpose());
    }

    @Transactional
    public void updateLang(PortalCustomerLangRequest req) {
        Long accountId = SecurityUtils.currentPortalCustomerId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录"));
        if (!StringUtils.hasText(req.getLang())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "lang 不能为空");
        }
        PortalCustomerAccount acc = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "账号不存在"));
        acc.setLang(req.getLang().trim());
        accountRepository.save(acc);
    }

    @Transactional
    public void updateProfile(PortalCustomerProfileRequest req) {
        Long accountId = SecurityUtils.currentPortalCustomerId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录"));
        PortalCustomerAccount acc = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "账号不存在"));
        if (req.getDisplayName() != null) {
            acc.setDisplayName(req.getDisplayName().trim());
        }
        if (req.getContact() != null) {
            acc.setContact(req.getContact().trim());
        }
        accountRepository.save(acc);
    }

    @Transactional
    public void bindViewToken(PortalBindViewTokenRequest body) {
        Long accountId = SecurityUtils.currentPortalCustomerId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录"));
        if (!StringUtils.hasText(body.getViewToken())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "viewToken 不能为空");
        }
        tryBindViewToken(accountId, body.getViewToken().trim());
    }

    @Transactional
    public void bindOrderWithProof(PortalBindOrderRequest body) {
        Long accountId = SecurityUtils.currentPortalCustomerId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录"));
        if (!StringUtils.hasText(body.getOrderNumber()) || !StringUtils.hasText(body.getProofToken())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "订单号与凭证不能为空");
        }
        Order order = orderRepository.findByOrderNumber(body.getOrderNumber().trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
        String proof = body.getProofToken().trim();
        if (!proofMatchesOrder(proof, order.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "凭证与订单不匹配或已失效");
        }
        upsertBinding(accountId, order.getId(), "ORDER_PROOF");
    }

    @Transactional(readOnly = true)
    public List<PortalCustomerOrderListItemDto> listMyOrders() {
        Long accountId = SecurityUtils.currentPortalCustomerId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录"));
        return bindingRepository.findByPortalCustomerIdOrderByCreatedAtDesc(accountId).stream()
                .map(b -> {
                    Order o = orderRepository.findById(b.getOrderId())
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
                    return PortalCustomerOrderListItemDto.builder()
                            .orderId(o.getId())
                            .orderNumber(o.getOrderNumber())
                            .displayTitle(customerOrderViewService.resolveDisplayTitleForOrder(o))
                            .currentStatus(o.getStatus().name())
                            .currentStatusLabel(o.getStatus().getDescription())
                            .createdAt(o.getCreatedAt() != null ? ISO.format(o.getCreatedAt()) : null)
                            .build();
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public CustomerOrderPublicDto getOrderSummary(long orderId) {
        Long accountId = SecurityUtils.currentPortalCustomerId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录"));
        bindingRepository.findByPortalCustomerIdAndOrderId(accountId, orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "无权查看该订单或未绑定"));
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
        CustomerOrderPublicDto dto = customerOrderViewService.buildPublicProgressDto(order);
        dto.setServiceType(order.getServiceType() != null ? order.getServiceType().name() : null);
        dto.setSalePrice(order.getSalePrice());
        dto.setCanPublishToStorefront(storefrontService.canPublish(accountId, orderId));
        return dto;
    }

    @Transactional
    public void rejectOrder(long orderId, String eventType, String reason) {
        Long accountId = requireBoundAccount(orderId);
        OrderEventType type;
        try {
            type = OrderEventType.fromString(eventType);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        orderEventService.rejectByCustomer(orderId, type, AccountKind.C_PORTAL_CUSTOMER, accountId, "CUSTOMER", reason);
    }

    /**
     * 客户确认设计稿 / 建模稿（事后认可，不改状态机）：写 customerApproved + 落事件卡片。
     */
    @Transactional
    public void confirmOrder(long orderId, String eventType) {
        OrderPiece piece = orderPieceService.ensureDefaultPiece(orderId);
        confirmPiece(orderId, piece.getId(), eventType);
    }

    @Transactional
    public void confirmPiece(long orderId, long pieceId, String eventType) {
        Long accountId = requireBoundAccount(orderId);
        OrderPiece piece = orderPieceService.requirePiece(orderId, pieceId);
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
        OrderEventType type;
        try {
            type = OrderEventType.fromString(eventType);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        if (type == OrderEventType.DESIGN_CONFIRM) {
            DesignInfo di = designInfoRepository.findByPieceId(pieceId).orElseGet(() -> {
                DesignInfo d = new DesignInfo();
                d.setOrderId(orderId);
                d.setPieceId(pieceId);
                return d;
            });
            di.setCustomerApproved(true);
            di.setApprovalTime(LocalDateTime.now());
            di.setApprovalNotes("客户已确认设计稿（" + piece.getName() + "）");
            designInfoRepository.save(di);
            orderPieceService.markDesignConfirmed(orderId, pieceId);
            String title = "确认设计 · " + piece.getName();
            orderEventService.record(orderId, type, AccountKind.C_PORTAL_CUSTOMER, accountId, "CUSTOMER",
                    title, null, null, null, pieceId, null);
            orderCommandService.tryAdvanceAfterAllDesignConfirmed(order);
            Order afterDesign = orderRepository.findById(orderId).orElse(order);
            if (orderPieceService.allDesignConfirmed(orderId)
                    && afterDesign.getServiceType() != ServiceType.CUSTOM_IMAGE) {
                orderEventService.record(orderId, OrderEventType.BALANCE_PAYMENT,
                        AccountKind.C_PORTAL_CUSTOMER, accountId, "CUSTOMER",
                        OrderEventType.BALANCE_PAYMENT.getDescription(),
                        "尾款金额：$" + BALANCE_AMOUNT_USD, null, null);
            }
        } else if (type == OrderEventType.MODEL_CONFIRM) {
            ModelingInfo mi = modelingInfoRepository.findByPieceId(pieceId).orElseGet(() -> {
                ModelingInfo m = new ModelingInfo();
                m.setOrderId(orderId);
                m.setPieceId(pieceId);
                return m;
            });
            mi.setCustomerApproved(true);
            mi.setApprovalTime(LocalDateTime.now());
            mi.setApprovalNotes("客户已确认建模稿（" + piece.getName() + "）");
            modelingInfoRepository.save(mi);
            orderPieceService.markModelConfirmed(orderId, pieceId);
            String title = "确认建模 · " + piece.getName();
            orderEventService.record(orderId, type, AccountKind.C_PORTAL_CUSTOMER, accountId, "CUSTOMER",
                    title, null, null, null, pieceId, null);
            orderCommandService.tryAdvanceAfterAllModelConfirmed(order);
            if (orderPieceService.allModelConfirmed(orderId)
                    && order.getServiceType() == ServiceType.CUSTOM_IMAGE) {
                orderEventService.record(orderId, OrderEventType.BALANCE_PAYMENT,
                        AccountKind.C_PORTAL_CUSTOMER, accountId, "CUSTOMER",
                        OrderEventType.BALANCE_PAYMENT.getDescription(),
                        "尾款金额：$" + BALANCE_AMOUNT_USD, null, null);
            }
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "确认类型仅支持 DESIGN_CONFIRM / MODEL_CONFIRM");
        }
    }

    @Transactional
    public void rejectPiece(long orderId, long pieceId, String eventType, String reason) {
        Long accountId = requireBoundAccount(orderId);
        OrderPiece piece = orderPieceService.requirePiece(orderId, pieceId);
        OrderEventType type;
        try {
            type = OrderEventType.fromString(eventType);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        if (type != OrderEventType.DESIGN_REJECT && type != OrderEventType.MODEL_REJECT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "驳回类型不正确");
        }
        String title = (type == OrderEventType.DESIGN_REJECT ? "驳回设计 · " : "驳回建模 · ") + piece.getName();
        orderEventService.rejectByCustomer(orderId, type, AccountKind.C_PORTAL_CUSTOMER, accountId, "CUSTOMER", reason,
                pieceId, title);
        if (type == OrderEventType.DESIGN_REJECT) {
            orderPieceService.resetDesignConfirmation(orderId, pieceId);
            designInfoRepository.findByPieceId(pieceId).ifPresent(di -> {
                di.setCustomerApproved(false);
                designInfoRepository.save(di);
            });
        } else {
            orderPieceService.resetModelConfirmation(orderId, pieceId);
            modelingInfoRepository.findByPieceId(pieceId).ifPresent(mi -> {
                mi.setCustomerApproved(false);
                modelingInfoRepository.save(mi);
            });
        }
    }

    /**
     * 客户确认收货/付尾款（mock）：仅 PRODUCING 状态可推进到 COMPLETED。
     */
    /** 默认尾款金额（美元）。 */
    private static final int BALANCE_AMOUNT_USD = 399;

    /**
     * 客户支付尾款（mock）：记录尾款已支付事件卡片，锁定尾款支付卡片。
     */
    @Transactional
    public void payBalance(long orderId) {
        Long accountId = requireBoundAccount(orderId);
        orderEventService.record(orderId, OrderEventType.BALANCE_PAID,
                AccountKind.C_PORTAL_CUSTOMER, accountId, "CUSTOMER",
                OrderEventType.BALANCE_PAID.getDescription(),
                "尾款 $" + BALANCE_AMOUNT_USD + " 已支付（模拟）", null, null);
    }

    @Transactional
    public void confirmDelivery(long orderId) {
        Long accountId = requireBoundAccount(orderId);
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
        if (order.getStatus() != OrderStatus.PRODUCING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "仅「生产中」订单可确认收货");
        }
        try {
            order.transitionTo(OrderStatus.COMPLETED);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        orderRepository.save(order);
        storefrontWalletService.settleOnCompleted(orderId);
        referralService.settleOnCompleted(orderId);
        orderEventService.record(orderId, OrderEventType.DELIVERY_CONFIRM,
                AccountKind.C_PORTAL_CUSTOMER, accountId, "CUSTOMER",
                "客户确认收货，订单已交付", "尾款已结清（mock）", null, null);
    }

    @Transactional(readOnly = true)
    public List<OrderEventDto> listOrderEvents(long orderId) {
        requireBoundAccount(orderId);
        return orderEventService.listByOrder(orderId);
    }

    @Transactional(readOnly = true)
    public OrderShipmentDto getOrderShipment(long orderId) {
        requireBoundAccount(orderId);
        return shipmentService.getShipmentForCustomer(orderId);
    }

    private Long requireBoundAccount(long orderId) {
        Long accountId = SecurityUtils.currentPortalCustomerId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录"));
        bindingRepository.findByPortalCustomerIdAndOrderId(accountId, orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "无权操作该订单或未绑定"));
        return accountId;
    }

    private void tryBindViewToken(Long portalCustomerId, String viewToken) {
        OrderCustomerViewLink link = viewLinkRepository.findByViewToken(viewToken)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "链接无效"));
        if (!OrderCustomerViewLink.LinkStatus.ACTIVE.equals(link.getStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "链接已失效");
        }
        if (link.getExpireTime() != null && link.getExpireTime().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "链接已过期");
        }
        upsertBinding(portalCustomerId, link.getOrderId(), "VIEW_TOKEN");
    }

    private void upsertBinding(Long portalCustomerId, Long orderId, String source) {
        var existingOrderBinding = bindingRepository.findByOrderId(orderId);
        if (existingOrderBinding.isPresent()) {
            if (!existingOrderBinding.get().getPortalCustomerId().equals(portalCustomerId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "该订单已绑定到其他客户账号");
            }
            return;
        }
        if (bindingRepository.findByPortalCustomerIdAndOrderId(portalCustomerId, orderId).isPresent()) {
            return;
        }
        PortalCustomerOrderBinding b = new PortalCustomerOrderBinding();
        b.setPortalCustomerId(portalCustomerId);
        b.setOrderId(orderId);
        b.setBindSource(source);
        bindingRepository.save(b);
    }

    private boolean proofMatchesOrder(String proofToken, Long orderId) {
        return viewLinkRepository.findByViewToken(proofToken)
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

    private void validateContactPassword(String contact, String password) {
        if (!StringUtils.hasText(contact) || !StringUtils.hasText(password)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "联系方式与密码不能为空");
        }
    }

    private PortalCustomerAccount createEmailAccount(String email, String displayName) {
        PortalCustomerAccount acc = new PortalCustomerAccount();
        acc.setContact(email);
        acc.setEmail(email);
        // 邮箱验证码账号不使用密码登录，填充不可猜测的占位密码
        acc.setPassword(passwordEncoder.encode(UUID.randomUUID().toString()));
        // 称呼默认置空，登录后由前端引导补全；未提供时不再回填邮箱
        acc.setDisplayName(StringUtils.hasText(displayName) ? displayName.trim() : null);
        return accountRepository.save(acc);
    }

    private String normalizeEmail(String email) {
        if (!StringUtils.hasText(email) || !email.contains("@")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "邮箱格式不正确");
        }
        return email.trim().toLowerCase();
    }

    private PortalCustomerLoginResponse toLoginResponse(PortalCustomerAccount acc) {
        PortalCustomerLoginResponse r = new PortalCustomerLoginResponse();
        r.setId(acc.getId());
        r.setContact(acc.getContact());
        r.setEmail(acc.getEmail());
        r.setDisplayName(acc.getDisplayName());
        r.setCreatedAt(acc.getCreatedAt());
        r.setAccessToken(jwtTokenProvider.createPortalCustomerAccessToken(acc.getId(), acc.getContact()));
        r.setExpiresIn(jwtTokenProvider.getAccessExpirationSeconds());
        return r;
    }
}
