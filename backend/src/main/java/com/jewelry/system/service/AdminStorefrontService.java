package com.jewelry.system.service;

import com.jewelry.system.dto.admin.AdminStorefrontListingDto;
import com.jewelry.system.dto.admin.AdminStorefrontOrderDto;
import com.jewelry.system.dto.admin.AdminStorefrontSellerDto;
import com.jewelry.system.dto.admin.AdminStorefrontWithdrawalDto;
import com.jewelry.system.dto.storefront.StorefrontListingUpdateRequest;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.PortalCustomerAccount;
import com.jewelry.system.entity.SellerWallet;
import com.jewelry.system.entity.SellerWithdrawRequest;
import com.jewelry.system.entity.StorefrontListing;
import com.jewelry.system.enums.OrderSource;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.PortalCustomerAccountRepository;
import com.jewelry.system.repository.SellerWalletRepository;
import com.jewelry.system.repository.SellerWithdrawRequestRepository;
import com.jewelry.system.repository.StorefrontListingRepository;
import com.jewelry.system.security.AccountKind;
import com.jewelry.system.util.SecurityUtils;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 员工端管理员对独立站商城（寄售）的管理：商品、商城订单、卖家概览与提现记录。
 * 与卖家自管接口的区别：归属无关，管理员可操作任意 listing。
 */
@Service
@RequiredArgsConstructor
public class AdminStorefrontService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final StorefrontListingRepository listingRepository;
    private final OrderRepository orderRepository;
    private final PortalCustomerAccountRepository accountRepository;
    private final SellerWalletRepository walletRepository;
    private final SellerWithdrawRequestRepository withdrawRepository;

    // ================= 商品管理 =================

    @Transactional(readOnly = true)
    public List<AdminStorefrontListingDto> listings(String status, String keyword) {
        assertAdmin();
        String statusFilter = StringUtils.hasText(status) ? status.trim().toUpperCase() : null;
        if (statusFilter != null && !statusFilter.equals("PUBLISHED") && !statusFilter.equals("PAUSED")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "未知的商品状态: " + status);
        }
        String kw = StringUtils.hasText(keyword) ? keyword.trim().toLowerCase() : null;
        Map<Long, PortalCustomerAccount> sellers = sellerAccountMap();
        return listingRepository.findAll().stream()
                .filter(l -> statusFilter == null || statusFilter.equals(l.getStatus()))
                .filter(l -> kw == null || (l.getTitle() != null && l.getTitle().toLowerCase().contains(kw)))
                .sorted(Comparator.comparing(StorefrontListing::getUpdatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(l -> toListingDto(l, sellers.get(l.getSellerAccountId())))
                .toList();
    }

    @Transactional
    public AdminStorefrontListingDto updateListing(long listingId, StorefrontListingUpdateRequest req) {
        assertAdmin();
        StorefrontListing listing = listingRepository.findById(listingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "商品不存在"));
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
        return toListingDto(listing, accountRepository.findById(listing.getSellerAccountId()).orElse(null));
    }

    @Transactional
    public AdminStorefrontListingDto pause(long listingId) {
        assertAdmin();
        StorefrontListing listing = listingRepository.findById(listingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "商品不存在"));
        listing.setStatus("PAUSED");
        listingRepository.save(listing);
        return toListingDto(listing, accountRepository.findById(listing.getSellerAccountId()).orElse(null));
    }

    @Transactional
    public AdminStorefrontListingDto republish(long listingId) {
        assertAdmin();
        StorefrontListing listing = listingRepository.findById(listingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "商品不存在"));
        listing.setStatus("PUBLISHED");
        listingRepository.save(listing);
        return toListingDto(listing, accountRepository.findById(listing.getSellerAccountId()).orElse(null));
    }

    // ================= 商城订单 =================

    @Transactional(readOnly = true)
    public Page<AdminStorefrontOrderDto> orders(Pageable pageable, String status, Long sellerId, String keyword) {
        assertAdmin();
        OrderStatus statusFilter = null;
        if (StringUtils.hasText(status)) {
            try {
                statusFilter = OrderStatus.fromString(status.trim());
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
            }
        }
        final OrderStatus st = statusFilter;
        final Long sid = sellerId;
        final String kw = StringUtils.hasText(keyword) ? keyword.trim() : null;
        Specification<Order> spec = (root, q, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            ps.add(cb.equal(root.get("source"), OrderSource.MARKETPLACE));
            if (st != null) {
                ps.add(cb.equal(root.get("status"), st));
            }
            if (sid != null) {
                ps.add(cb.equal(root.get("marketplaceSellerId"), sid));
            }
            if (kw != null) {
                String like = "%" + kw.toLowerCase() + "%";
                ps.add(cb.or(
                        cb.like(cb.lower(root.get("orderNumber")), like),
                        cb.like(cb.lower(root.get("customerName")), like)));
            }
            return cb.and(ps.toArray(new Predicate[0]));
        };
        Map<Long, PortalCustomerAccount> sellers = sellerAccountMap();
        Map<Long, StorefrontListing> listings = listingRepository.findAll().stream()
                .collect(Collectors.toMap(StorefrontListing::getId, Function.identity(), (a, b) -> a));
        return orderRepository.findAll(spec, pageable).map(o -> toOrderDto(o, sellers, listings));
    }

    // ================= 卖家概览 =================

    @Transactional(readOnly = true)
    public List<AdminStorefrontSellerDto> sellers() {
        assertAdmin();
        Map<Long, PortalCustomerAccount> accounts = sellerAccountMap();
        Map<Long, SellerWallet> wallets = walletRepository.findAll().stream()
                .collect(Collectors.toMap(SellerWallet::getAccountId, Function.identity(), (a, b) -> a));
        Map<Long, List<StorefrontListing>> bySeller = listingRepository.findAll().stream()
                .collect(Collectors.groupingBy(StorefrontListing::getSellerAccountId, LinkedHashMap::new, Collectors.toList()));
        // 以「有商品的卖家 ∪ 有钱包的卖家」为准
        Map<Long, AdminStorefrontSellerDto> result = new LinkedHashMap<>();
        bySeller.forEach((accountId, listings) -> result.put(accountId, buildSellerDto(accountId, listings,
                accounts.get(accountId), wallets.get(accountId))));
        wallets.keySet().forEach(accountId -> result.computeIfAbsent(accountId,
                id -> buildSellerDto(id, List.of(), accounts.get(id), wallets.get(id))));
        return result.values().stream()
                .sorted(Comparator.comparing(AdminStorefrontSellerDto::getTotalEarned,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AdminStorefrontWithdrawalDto> withdrawals() {
        assertAdmin();
        Map<Long, PortalCustomerAccount> accounts = sellerAccountMap();
        return withdrawRepository.findAll().stream()
                .sorted(Comparator.comparing(SellerWithdrawRequest::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(w -> AdminStorefrontWithdrawalDto.builder()
                        .id(w.getId())
                        .accountId(w.getAccountId())
                        .sellerDisplayName(sellerName(accounts.get(w.getAccountId())))
                        .amount(w.getAmount())
                        .status(w.getStatus())
                        .remark(w.getRemark())
                        .createdAt(w.getCreatedAt() != null ? ISO.format(w.getCreatedAt()) : null)
                        .build())
                .toList();
    }

    // ================= 内部方法 =================

    private AdminStorefrontSellerDto buildSellerDto(Long accountId, List<StorefrontListing> listings,
                                                    PortalCustomerAccount account, SellerWallet wallet) {
        long published = listings.stream().filter(l -> "PUBLISHED".equals(l.getStatus())).count();
        long sold = listings.stream().mapToLong(l -> l.getSoldCount() == null ? 0 : l.getSoldCount()).sum();
        return AdminStorefrontSellerDto.builder()
                .accountId(accountId)
                .displayName(sellerName(account))
                .contact(account != null ? account.getContact() : null)
                .email(account != null ? account.getEmail() : null)
                .listingCount(listings.size())
                .publishedCount(published)
                .soldCount(sold)
                .availableBalance(wallet != null ? nz(wallet.getAvailableBalance()) : BigDecimal.ZERO)
                .pendingBalance(wallet != null ? nz(wallet.getPendingBalance()) : BigDecimal.ZERO)
                .totalEarned(wallet != null ? nz(wallet.getTotalEarned()) : BigDecimal.ZERO)
                .totalWithdrawn(wallet != null ? nz(wallet.getTotalWithdrawn()) : BigDecimal.ZERO)
                .build();
    }

    private AdminStorefrontListingDto toListingDto(StorefrontListing l, PortalCustomerAccount seller) {
        return AdminStorefrontListingDto.builder()
                .id(l.getId())
                .sourceOrderId(l.getSourceOrderId())
                .title(l.getTitle())
                .description(l.getDescription())
                .coverImageUrl(l.getCoverImageUrl())
                .salePrice(l.getSalePrice())
                .status(l.getStatus())
                .soldCount(l.getSoldCount())
                .createdAt(l.getCreatedAt() != null ? ISO.format(l.getCreatedAt()) : null)
                .updatedAt(l.getUpdatedAt() != null ? ISO.format(l.getUpdatedAt()) : null)
                .sellerAccountId(l.getSellerAccountId())
                .sellerDisplayName(sellerName(seller))
                .sellerContact(seller != null ? seller.getContact() : null)
                .build();
    }

    private AdminStorefrontOrderDto toOrderDto(Order o, Map<Long, PortalCustomerAccount> sellers,
                                               Map<Long, StorefrontListing> listings) {
        StorefrontListing listing = o.getListingId() == null ? null : listings.get(o.getListingId());
        return AdminStorefrontOrderDto.builder()
                .orderId(o.getId())
                .orderNumber(o.getOrderNumber())
                .buyerName(o.getCustomerName())
                .listingId(o.getListingId())
                .listingTitle(listing != null ? listing.getTitle() : null)
                .sellerAccountId(o.getMarketplaceSellerId())
                .sellerDisplayName(sellerName(o.getMarketplaceSellerId() == null ? null : sellers.get(o.getMarketplaceSellerId())))
                .salePrice(o.getSalePrice())
                .productionFee(o.getProductionFee())
                .shippingFee(o.getShippingFee())
                .sellerPayout(o.getSellerPayout())
                .status(o.getStatus() != null ? o.getStatus().name() : null)
                .statusLabel(o.getStatus() != null ? o.getStatus().getDescription() : null)
                .orderTime(o.getOrderTime() != null ? ISO.format(o.getOrderTime()) : null)
                .createdAt(o.getCreatedAt() != null ? ISO.format(o.getCreatedAt()) : null)
                .build();
    }

    private Map<Long, PortalCustomerAccount> sellerAccountMap() {
        return accountRepository.findAll().stream()
                .collect(Collectors.toMap(PortalCustomerAccount::getId, Function.identity(), (a, b) -> a));
    }

    private String sellerName(PortalCustomerAccount account) {
        if (account == null) {
            return "duxury maker";
        }
        return StringUtils.hasText(account.getDisplayName()) ? account.getDisplayName() : "duxury maker";
    }

    private void assertAdmin() {
        var principal = SecurityUtils.currentPrincipal()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        boolean isStaffAdmin = AccountKind.STAFF.equals(principal.getAccountKind())
                && "ADMIN".equals(principal.getRoleApi());
        if (!isStaffAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可访问");
        }
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
