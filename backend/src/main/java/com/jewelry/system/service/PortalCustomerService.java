package com.jewelry.system.service;

import com.jewelry.system.dto.customer.CustomerOrderPublicDto;
import com.jewelry.system.dto.portal.*;
import com.jewelry.system.entity.*;
import com.jewelry.system.repository.OrderAccessLinkRepository;
import com.jewelry.system.repository.OrderCustomerViewLinkRepository;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.PortalCustomerAccountRepository;
import com.jewelry.system.repository.PortalCustomerOrderBindingRepository;
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

@Service
@RequiredArgsConstructor
public class PortalCustomerService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final PortalCustomerAccountRepository accountRepository;
    private final PortalCustomerOrderBindingRepository bindingRepository;
    private final OrderRepository orderRepository;
    private final OrderCustomerViewLinkRepository viewLinkRepository;
    private final OrderAccessLinkRepository accessLinkRepository;
    private final CustomerOrderViewService customerOrderViewService;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

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
        return customerOrderViewService.buildPublicProgressDto(order);
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

    private PortalCustomerLoginResponse toLoginResponse(PortalCustomerAccount acc) {
        PortalCustomerLoginResponse r = new PortalCustomerLoginResponse();
        r.setId(acc.getId());
        r.setContact(acc.getContact());
        r.setDisplayName(acc.getDisplayName());
        r.setCreatedAt(acc.getCreatedAt());
        r.setAccessToken(jwtTokenProvider.createPortalCustomerAccessToken(acc.getId(), acc.getContact()));
        r.setExpiresIn(jwtTokenProvider.getAccessExpirationSeconds());
        return r;
    }
}
