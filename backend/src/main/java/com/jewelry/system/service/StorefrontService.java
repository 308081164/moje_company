package com.jewelry.system.service;

import com.jewelry.system.dto.conversation.ConversationDto;
import com.jewelry.system.dto.storefront.*;
import com.jewelry.system.entity.*;
import com.jewelry.system.enums.OrderEventType;
import com.jewelry.system.enums.OrderSource;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.enums.ServiceType;
import com.jewelry.system.repository.*;
import com.jewelry.system.security.AccountKind;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class StorefrontService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final SysConfigRepository sysConfigRepository;
    private final StorefrontListingRepository listingRepository;
    private final OrderRepository orderRepository;
    private final PortalCustomerOrderBindingRepository bindingRepository;
    private final PortalCustomerAccountRepository accountRepository;
    private final DesignInfoRepository designInfoRepository;
    private final ModelingInfoRepository modelingInfoRepository;
    private final CustomerOrderViewService customerOrderViewService;
    private final OrderCommandService orderCommandService;
    private final AutoAssignmentService autoAssignmentService;
    private final ConversationService conversationService;
    private final OrderEventService orderEventService;
    private final StorefrontWalletService walletService;
    private final SellerWalletRepository walletRepository;
    private final SellerWithdrawRequestRepository withdrawRepository;

    @Transactional(readOnly = true)
    public StorefrontFeeGuideDto feeGuide() {
        return StorefrontFeeGuideDto.builder()
                .currency("USD")
                .productionFeeMin(decimal("storefront.productionFeeMin", "180"))
                .productionFeeMax(decimal("storefront.productionFeeMax", "680"))
                .shippingFeeMin(decimal("storefront.shippingFeeMin", "15"))
                .shippingFeeMax(decimal("storefront.shippingFeeMax", "45"))
                .note("Production and shipping are handled by the studio. These ranges are shown so you can price your piece; they are deducted from the sale price when a buyer pays.")
                .build();
    }

    @Transactional(readOnly = true)
    public List<StorefrontListingDto> publicListings() {
        return listingRepository.findByStatusOrderByUpdatedAtDesc("PUBLISHED").stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public StorefrontListingDto publicListing(long id) {
        StorefrontListing listing = listingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "商品不存在"));
        if (!"PUBLISHED".equals(listing.getStatus())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "商品未上架");
        }
        return toDto(listing);
    }

    @Transactional(readOnly = true)
    public boolean canPublish(Long accountId, long orderId) {
        try {
            assertCanPublish(accountId, orderId);
            return true;
        } catch (ResponseStatusException e) {
            return false;
        }
    }

    @Transactional
    public StorefrontListingDto publish(StorefrontPublishRequest req) {
        Long accountId = requireCustomer();
        if (req == null || req.getSourceOrderId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "缺少原订单");
        }
        if (req.getSalePrice() == null || req.getSalePrice().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请填写售价");
        }
        Order source = assertCanPublish(accountId, req.getSourceOrderId());
        StorefrontFeeGuideDto fees = feeGuide();
        StorefrontListing listing = listingRepository.findBySourceOrderId(source.getId()).orElseGet(StorefrontListing::new);
        listing.setSourceOrderId(source.getId());
        listing.setSellerAccountId(accountId);
        listing.setTitle(StringUtils.hasText(req.getTitle()) ? req.getTitle().trim() : defaultTitle(source));
        listing.setDescription(req.getDescription());
        listing.setSalePrice(req.getSalePrice().setScale(2, RoundingMode.HALF_UP));
        listing.setProductionFeeMin(fees.getProductionFeeMin());
        listing.setProductionFeeMax(fees.getProductionFeeMax());
        listing.setShippingFeeMin(fees.getShippingFeeMin());
        listing.setShippingFeeMax(fees.getShippingFeeMax());
        listing.setCoverImageUrl(resolveCover(source));
        listing.setStatus("PUBLISHED");
        if (listing.getSoldCount() == null) {
            listing.setSoldCount(0);
        }
        listingRepository.save(listing);
        return toDto(listing);
    }

    @Transactional
    public StorefrontListingDto pause(long listingId) {
        StorefrontListing listing = requireOwnListing(listingId);
        listing.setStatus("PAUSED");
        listingRepository.save(listing);
        return toDto(listing);
    }

    @Transactional
    public StorefrontListingDto republish(long listingId) {
        StorefrontListing listing = requireOwnListing(listingId);
        listing.setStatus("PUBLISHED");
        listingRepository.save(listing);
        return toDto(listing);
    }

    @Transactional(readOnly = true)
    public List<StorefrontListingDto> sellerListings() {
        Long accountId = requireCustomer();
        return listingRepository.findBySellerAccountIdOrderByUpdatedAtDesc(accountId)
                .stream().map(this::toDto).toList();
    }

    @Transactional
    public StorefrontListingDto updateListing(long listingId, StorefrontListingUpdateRequest req) {
        StorefrontListing listing = requireOwnListing(listingId);
        if (req == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "缺少修改内容");
        }
        if (req.getTitle() != null) {
            if (!StringUtils.hasText(req.getTitle())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "标题不能为空");
            }
            String title = req.getTitle().trim();
            listing.setTitle(title.length() > 200 ? title.substring(0, 200) : title);
        }
        if (req.getDescription() != null) {
            listing.setDescription(req.getDescription());
        }
        if (req.getSalePrice() != null) {
            if (req.getSalePrice().compareTo(BigDecimal.ZERO) <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "售价必须大于 0");
            }
            listing.setSalePrice(req.getSalePrice().setScale(2, RoundingMode.HALF_UP));
        }
        if (req.getCoverImageUrl() != null) {
            String url = req.getCoverImageUrl().trim();
            listing.setCoverImageUrl(url.length() > 1000 ? url.substring(0, 1000) : url);
        }
        listingRepository.save(listing);
        return toDto(listing);
    }

    @Transactional
    public StorefrontPurchaseResponse purchase(long listingId, StorefrontPurchaseRequest req) {
        Long buyerId = requireCustomer();
        StorefrontListing listing = listingRepository.findById(listingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "商品不存在"));
        if (!"PUBLISHED".equals(listing.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "该商品已下架");
        }
        if (listing.getSellerAccountId().equals(buyerId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不能购买自己发布的商品");
        }
        Order source = orderRepository.findById(listing.getSourceOrderId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "原订单不存在"));

        BigDecimal production = mid(listing.getProductionFeeMin(), listing.getProductionFeeMax());
        BigDecimal shipping = mid(listing.getShippingFeeMin(), listing.getShippingFeeMax());
        BigDecimal payout = listing.getSalePrice().subtract(production).subtract(shipping);
        if (payout.compareTo(BigDecimal.ZERO) < 0) {
            payout = BigDecimal.ZERO;
        }

        Order order = new Order();
        order.setSource(OrderSource.MARKETPLACE);
        order.setServiceType(ServiceType.STOREFRONT);
        order.setIsB2b(false);
        order.setCustomerName(StringUtils.hasText(req != null ? req.getCustomerName() : null)
                ? req.getCustomerName().trim()
                : accountRepository.findById(buyerId).map(PortalCustomerAccount::getDisplayName).orElse("Storefront buyer"));
        String contact = req != null ? req.getCustomerContact() : null;
        if (StringUtils.hasText(contact)) {
            String c = contact.trim();
            if (c.length() <= 20) {
                order.setCustomerPhone(c);
            } else {
                order.setCustomerWechat(c.length() > 100 ? c.substring(0, 100) : c);
            }
        }
        String note = req != null && StringUtils.hasText(req.getNote()) ? req.getNote().trim() : "";
        String addr = req != null && StringUtils.hasText(req.getShippingAddress()) ? req.getShippingAddress().trim() : "";
        order.setBasicRequirements("独立站寄售复产：" + listing.getTitle()
                + (addr.isBlank() ? "" : "\n收货地址：" + addr)
                + (note.isBlank() ? "" : "\n备注：" + note));
        order.setStyleInfo(source.getStyleInfo());
        order.setMaterialInfo(source.getMaterialInfo());
        order.setDeposit(listing.getSalePrice());
        order.setOrderTime(LocalDateTime.now());
        order.setOrderNumber(orderCommandService.generateOrderNumber());
        order.setStatus(OrderStatus.PENDING_PRODUCTION);
        order.setListingId(listing.getId());
        order.setMarketplaceSellerId(listing.getSellerAccountId());
        order.setSalePrice(listing.getSalePrice());
        order.setProductionFee(production);
        order.setShippingFee(shipping);
        order.setSellerPayout(payout);
        orderRepository.save(order);

        PortalCustomerOrderBinding binding = new PortalCustomerOrderBinding();
        binding.setPortalCustomerId(buyerId);
        binding.setOrderId(order.getId());
        binding.setBindSource("STOREFRONT_PURCHASE");
        bindingRepository.save(binding);

        copyDesignAndModel(source.getId(), order.getId());

        LocalDateTime now = LocalDateTime.now();
        if (source.getDesignCompletedTime() != null) {
            order.setDesignCompletedTime(source.getDesignCompletedTime());
        } else {
            order.setDesignCompletedTime(now);
        }
        if (source.getModelCompletedTime() != null) {
            order.setModelCompletedTime(source.getModelCompletedTime());
        } else {
            order.setModelCompletedTime(now);
        }
        order.setReviewCompletedTime(now);
        autoAssignmentService.autoAssignMarketplaceOrder(order);
        try {
            order.transitionTo(OrderStatus.PRODUCING);
        } catch (IllegalStateException ignored) {
            /* keep PENDING_PRODUCTION */
        }
        orderRepository.save(order);

        listing.setSoldCount((listing.getSoldCount() == null ? 0 : listing.getSoldCount()) + 1);
        listingRepository.save(listing);

        walletService.holdPayout(order);
        ConversationDto conversation = conversationService.ensureConversationByOrder(order.getId());
        orderEventService.record(order.getId(), OrderEventType.STATUS_CHANGE,
                AccountKind.C_PORTAL_CUSTOMER, buyerId, "CUSTOMER",
                "独立站寄售下单已支付（模拟）",
                "售价 $" + listing.getSalePrice() + " · 代工 $" + production + " · 代邮 $" + shipping,
                null, null);

        return StorefrontPurchaseResponse.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .conversationId(conversation.getId())
                .build();
    }

    @Transactional(readOnly = true)
    public SellerDashboardDto sellerDashboard() {
        Long accountId = requireCustomer();
        SellerWallet wallet = walletRepository.findByAccountId(accountId).orElse(null);
        BigDecimal available = wallet != null ? nz(wallet.getAvailableBalance()) : BigDecimal.ZERO;
        BigDecimal pending = wallet != null ? nz(wallet.getPendingBalance()) : BigDecimal.ZERO;
        BigDecimal earned = wallet != null ? nz(wallet.getTotalEarned()) : BigDecimal.ZERO;
        BigDecimal withdrawn = wallet != null ? nz(wallet.getTotalWithdrawn()) : BigDecimal.ZERO;
        List<StorefrontListingDto> listings = listingRepository.findBySellerAccountIdOrderByUpdatedAtDesc(accountId)
                .stream().map(this::toDto).toList();
        int sold = listings.stream().mapToInt(l -> l.getSoldCount() == null ? 0 : l.getSoldCount()).sum();
        List<SellerSaleDto> sales = new ArrayList<>();
        for (Order o : orderRepository.findByMarketplaceSellerIdOrderByCreatedAtDesc(accountId)) {
            StorefrontListing listing = o.getListingId() == null ? null : listingRepository.findById(o.getListingId()).orElse(null);
            sales.add(SellerSaleDto.builder()
                    .orderId(o.getId())
                    .orderNumber(o.getOrderNumber())
                    .listingTitle(listing != null ? listing.getTitle() : o.getBasicRequirements())
                    .status(o.getStatus() != null ? o.getStatus().name() : null)
                    .statusLabel(o.getStatus() != null ? o.getStatus().getDescription() : null)
                    .salePrice(o.getSalePrice())
                    .productionFee(o.getProductionFee())
                    .shippingFee(o.getShippingFee())
                    .sellerPayout(o.getSellerPayout())
                    .createdAt(o.getCreatedAt() != null ? ISO.format(o.getCreatedAt()) : null)
                    .build());
        }
        List<SellerWithdrawDto> withdrawals = withdrawRepository.findByAccountIdOrderByCreatedAtDesc(accountId).stream()
                .map(w -> SellerWithdrawDto.builder()
                        .id(w.getId())
                        .amount(w.getAmount())
                        .status(w.getStatus())
                        .remark(w.getRemark())
                        .createdAt(w.getCreatedAt() != null ? ISO.format(w.getCreatedAt()) : null)
                        .build())
                .toList();
        return SellerDashboardDto.builder()
                .availableBalance(available)
                .pendingBalance(pending)
                .totalEarned(earned)
                .totalWithdrawn(withdrawn)
                .listingCount(listings.size())
                .soldCount(sold)
                .listings(listings)
                .recentSales(sales)
                .withdrawals(withdrawals)
                .feeGuide(feeGuide())
                .build();
    }

    @Transactional
    public SellerWithdrawDto withdraw(BigDecimal amount) {
        Long accountId = requireCustomer();
        SellerWithdrawRequest req = walletService.withdraw(accountId, amount);
        return SellerWithdrawDto.builder()
                .id(req.getId())
                .amount(req.getAmount())
                .status(req.getStatus())
                .remark(req.getRemark())
                .createdAt(req.getCreatedAt() != null ? ISO.format(req.getCreatedAt()) : null)
                .build();
    }

    private Order assertCanPublish(Long accountId, long orderId) {
        bindingRepository.findByPortalCustomerIdAndOrderId(accountId, orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "只能发布自己的订单"));
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
        if (order.getSource() == OrderSource.MARKETPLACE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "寄售复产订单不能再次上架");
        }
        ModelingInfo mi = modelingInfoRepository.findByOrderId(orderId).orElse(null);
        boolean modeled = mi != null && Boolean.TRUE.equals(mi.getCustomerApproved());
        boolean lateStage = order.getStatus() == OrderStatus.PENDING_PRODUCTION
                || order.getStatus() == OrderStatus.PRODUCING
                || order.getStatus() == OrderStatus.COMPLETED;
        if (!modeled && !lateStage) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请先完成设计与打样（确认建模稿）后再上架");
        }
        return order;
    }

    private StorefrontListing requireOwnListing(long listingId) {
        Long accountId = requireCustomer();
        StorefrontListing listing = listingRepository.findById(listingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "商品不存在"));
        if (!listing.getSellerAccountId().equals(accountId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权操作该商品");
        }
        return listing;
    }

    private void copyDesignAndModel(Long fromOrderId, Long toOrderId) {
        designInfoRepository.findByOrderId(fromOrderId).ifPresent(src -> {
            DesignInfo di = new DesignInfo();
            di.setOrderId(toOrderId);
            di.setProcessInfoJson(src.getProcessInfoJson());
            di.setStoneInfoJson(src.getStoneInfoJson());
            di.setDesignImagesJson(src.getDesignImagesJson());
            di.setCustomerApproved(true);
            di.setApprovalTime(LocalDateTime.now());
            designInfoRepository.save(di);
        });
        modelingInfoRepository.findByOrderId(fromOrderId).ifPresent(src -> {
            ModelingInfo mi = new ModelingInfo();
            mi.setOrderId(toOrderId);
            mi.setWeight(src.getWeight());
            mi.setModelFilesJson(src.getModelFilesJson());
            mi.setModelNotes(src.getModelNotes());
            mi.setModelEffectImagesJson(src.getModelEffectImagesJson());
            mi.setCustomerApproved(true);
            mi.setApprovalTime(LocalDateTime.now());
            modelingInfoRepository.save(mi);
        });
    }

    private StorefrontListingDto toDto(StorefrontListing listing) {
        String sellerName = accountRepository.findById(listing.getSellerAccountId())
                .map(a -> StringUtils.hasText(a.getDisplayName()) ? a.getDisplayName() : "duxury maker")
                .orElse("duxury maker");
        return StorefrontListingDto.builder()
                .id(listing.getId())
                .sourceOrderId(listing.getSourceOrderId())
                .title(listing.getTitle())
                .description(listing.getDescription())
                .coverImageUrl(listing.getCoverImageUrl())
                .salePrice(listing.getSalePrice())
                .productionFeeMin(listing.getProductionFeeMin())
                .productionFeeMax(listing.getProductionFeeMax())
                .shippingFeeMin(listing.getShippingFeeMin())
                .shippingFeeMax(listing.getShippingFeeMax())
                .status(listing.getStatus())
                .soldCount(listing.getSoldCount())
                .createdAt(listing.getCreatedAt() != null ? ISO.format(listing.getCreatedAt()) : null)
                .sellerDisplayName(sellerName)
                .build();
    }

    private String resolveCover(Order source) {
        DesignInfo di = designInfoRepository.findByOrderId(source.getId()).orElse(null);
        if (di != null && StringUtils.hasText(di.getDesignImagesJson())) {
            try {
                List<String> images = new com.fasterxml.jackson.databind.ObjectMapper().readValue(
                        di.getDesignImagesJson(),
                        new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});
                if (images != null) {
                    for (String u : images) {
                        if (StringUtils.hasText(u)) {
                            return u;
                        }
                    }
                }
            } catch (Exception ignored) {
                /* fall through */
            }
        }
        ModelingInfo mi = modelingInfoRepository.findByOrderId(source.getId()).orElse(null);
        if (mi != null && StringUtils.hasText(mi.getModelEffectImagesJson())) {
            try {
                List<String> images = new com.fasterxml.jackson.databind.ObjectMapper().readValue(
                        mi.getModelEffectImagesJson(),
                        new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});
                if (images != null) {
                    for (String u : images) {
                        if (StringUtils.hasText(u)) {
                            return u;
                        }
                    }
                }
            } catch (Exception ignored) {
                /* fall through */
            }
        }
        try {
            var dto = customerOrderViewService.buildPublicProgressDto(source);
            if (dto.getFirstDesignImageUrl() != null) {
                return dto.getFirstDesignImageUrl();
            }
        } catch (Exception ignored) {
            /* fall through */
        }
        return null;
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private String defaultTitle(Order source) {
        if (StringUtils.hasText(source.getStyleInfo())) {
            return source.getStyleInfo();
        }
        if (StringUtils.hasText(source.getBasicRequirements())) {
            String t = source.getBasicRequirements().trim();
            return t.length() > 80 ? t.substring(0, 80) : t;
        }
        return source.getOrderNumber();
    }

    private Long requireCustomer() {
        return SecurityUtils.currentPortalCustomerId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录"));
    }

    private BigDecimal decimal(String key, String def) {
        return sysConfigRepository.findByConfigKey(key)
                .map(SysConfig::getConfigValue)
                .filter(StringUtils::hasText)
                .map(v -> {
                    try {
                        return new BigDecimal(v.trim());
                    } catch (Exception e) {
                        return new BigDecimal(def);
                    }
                })
                .orElse(new BigDecimal(def));
    }

    private static BigDecimal mid(BigDecimal a, BigDecimal b) {
        BigDecimal x = a == null ? BigDecimal.ZERO : a;
        BigDecimal y = b == null ? x : b;
        return x.add(y).divide(new BigDecimal("2"), 2, RoundingMode.HALF_UP);
    }
}
