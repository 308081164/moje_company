package com.jewelry.system.service;

import com.jewelry.system.dto.admin.AdminStorefrontListingDto;
import com.jewelry.system.dto.admin.AdminStorefrontOrderDto;
import com.jewelry.system.dto.admin.AdminStorefrontSellerDto;
import com.jewelry.system.dto.storefront.StorefrontListingUpdateRequest;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.PortalCustomerAccount;
import com.jewelry.system.entity.SellerWallet;
import com.jewelry.system.entity.StorefrontListing;
import com.jewelry.system.enums.OrderSource;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.PortalCustomerAccountRepository;
import com.jewelry.system.repository.SellerWalletRepository;
import com.jewelry.system.repository.SellerWithdrawRequestRepository;
import com.jewelry.system.repository.StorefrontListingRepository;
import com.jewelry.system.security.AccountKind;
import com.jewelry.system.security.SecurityUserPrincipal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminStorefrontServiceTest {

    @Mock StorefrontListingRepository listingRepository;
    @Mock OrderRepository orderRepository;
    @Mock PortalCustomerAccountRepository accountRepository;
    @Mock SellerWalletRepository walletRepository;
    @Mock SellerWithdrawRequestRepository withdrawRepository;

    @InjectMocks
    AdminStorefrontService adminStorefrontService;

    @BeforeEach
    void loginAsAdmin() {
        SecurityUserPrincipal principal = new SecurityUserPrincipal(1L, "admin", "ADMIN", AccountKind.STAFF);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private void loginAs(String roleApi) {
        SecurityUserPrincipal principal = new SecurityUserPrincipal(2L, "staff", roleApi, AccountKind.STAFF);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    private StorefrontListing listing(long id, long sellerId, String status) {
        StorefrontListing l = new StorefrontListing();
        l.setId(id);
        l.setSourceOrderId(100L + id);
        l.setSellerAccountId(sellerId);
        l.setTitle("戒指定制款");
        l.setSalePrice(new BigDecimal("520.00"));
        l.setStatus(status);
        l.setSoldCount(3);
        l.setUpdatedAt(LocalDateTime.now());
        return l;
    }

    @Test
    void updateListing_adminCanEditAnySellersListing() {
        StorefrontListing existing = listing(1L, 99L, "PUBLISHED");
        when(listingRepository.findById(1L)).thenReturn(Optional.of(existing));

        StorefrontListingUpdateRequest req = new StorefrontListingUpdateRequest();
        req.setTitle("  管理员改标题  ");
        req.setDescription("管理员改描述");
        req.setSalePrice(new BigDecimal("888"));
        req.setCoverImageUrl("https://oss.example/new-cover.png");

        AdminStorefrontListingDto dto = adminStorefrontService.updateListing(1L, req);

        verify(listingRepository).save(existing);
        assertThat(existing.getTitle()).isEqualTo("管理员改标题");
        assertThat(existing.getDescription()).isEqualTo("管理员改描述");
        assertThat(existing.getSalePrice()).isEqualByComparingTo("888.00");
        assertThat(existing.getCoverImageUrl()).isEqualTo("https://oss.example/new-cover.png");
        assertThat(dto.getSellerAccountId()).isEqualTo(99L);
    }

    @Test
    void updateListing_rejectsNonPositivePrice() {
        StorefrontListing existing = listing(1L, 99L, "PUBLISHED");
        when(listingRepository.findById(1L)).thenReturn(Optional.of(existing));

        StorefrontListingUpdateRequest req = new StorefrontListingUpdateRequest();
        req.setSalePrice(BigDecimal.ZERO);

        assertThatThrownBy(() -> adminStorefrontService.updateListing(1L, req))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(listingRepository, never()).save(any());
    }

    @Test
    void updateListing_rejectsBlankTitle() {
        StorefrontListing existing = listing(1L, 99L, "PUBLISHED");
        when(listingRepository.findById(1L)).thenReturn(Optional.of(existing));

        StorefrontListingUpdateRequest req = new StorefrontListingUpdateRequest();
        req.setTitle("   ");

        assertThatThrownBy(() -> adminStorefrontService.updateListing(1L, req))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(listingRepository, never()).save(any());
    }

    @Test
    void updateListing_listingNotFound() {
        when(listingRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminStorefrontService.updateListing(404L, new StorefrontListingUpdateRequest()))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void pause_anyListingBelongingToAnySeller() {
        StorefrontListing existing = listing(1L, 99L, "PUBLISHED");
        when(listingRepository.findById(1L)).thenReturn(Optional.of(existing));

        AdminStorefrontListingDto dto = adminStorefrontService.pause(1L);

        verify(listingRepository).save(existing);
        assertThat(existing.getStatus()).isEqualTo("PAUSED");
        assertThat(dto.getStatus()).isEqualTo("PAUSED");
    }

    @Test
    void republish_anyListingBelongingToAnySeller() {
        StorefrontListing existing = listing(1L, 99L, "PAUSED");
        when(listingRepository.findById(1L)).thenReturn(Optional.of(existing));

        AdminStorefrontListingDto dto = adminStorefrontService.republish(1L);

        verify(listingRepository).save(existing);
        assertThat(existing.getStatus()).isEqualTo("PUBLISHED");
        assertThat(dto.getStatus()).isEqualTo("PUBLISHED");
    }

    @Test
    void listings_rejectsUnknownStatus() {
        assertThatThrownBy(() -> adminStorefrontService.listings("SOLD_OUT", null))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void orders_paginatesAndMapsMarketplaceOrders() {
        Order o1 = new Order();
        o1.setId(11L);
        o1.setOrderNumber("MO-001");
        o1.setCustomerName("买家A");
        o1.setSource(OrderSource.MARKETPLACE);
        o1.setStatus(OrderStatus.PRODUCING);
        o1.setMarketplaceSellerId(7L);
        o1.setListingId(5L);
        o1.setSalePrice(new BigDecimal("520.00"));
        o1.setProductionFee(new BigDecimal("300.00"));
        o1.setShippingFee(new BigDecimal("30.00"));
        o1.setSellerPayout(new BigDecimal("190.00"));
        o1.setOrderTime(LocalDateTime.of(2026, 10, 1, 12, 0));
        Order o2 = new Order();
        o2.setId(12L);
        o2.setOrderNumber("MO-002");
        o2.setCustomerName("买家B");
        o2.setSource(OrderSource.MARKETPLACE);
        o2.setStatus(OrderStatus.COMPLETED);
        o2.setMarketplaceSellerId(7L);

        Pageable pageable = PageRequest.of(0, 10);
        when(orderRepository.findAll(any(Specification.class), eq(pageable)))
                .thenReturn(new PageImpl<>(List.of(o1, o2), pageable, 2));

        StorefrontListing l = listing(5L, 7L, "PUBLISHED");
        l.setTitle("星河戒指");
        when(listingRepository.findAll()).thenReturn(List.of(l));
        PortalCustomerAccount seller = new PortalCustomerAccount();
        seller.setId(7L);
        seller.setDisplayName("duxury seller");
        when(accountRepository.findAll()).thenReturn(List.of(seller));

        Page<AdminStorefrontOrderDto> page = adminStorefrontService.orders(pageable, null, null, null);

        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(page.getContent()).hasSize(2);
        AdminStorefrontOrderDto first = page.getContent().get(0);
        assertThat(first.getOrderNumber()).isEqualTo("MO-001");
        assertThat(first.getBuyerName()).isEqualTo("买家A");
        assertThat(first.getSellerDisplayName()).isEqualTo("duxury seller");
        assertThat(first.getListingTitle()).isEqualTo("星河戒指");
        assertThat(first.getSalePrice()).isEqualByComparingTo("520.00");
        assertThat(first.getSellerPayout()).isEqualByComparingTo("190.00");
        assertThat(first.getStatusLabel()).isEqualTo("生产中");
    }

    @Test
    void orders_rejectsUnknownStatus() {
        assertThatThrownBy(() -> adminStorefrontService.orders(PageRequest.of(0, 10), "NOT_A_STATUS", null, null))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void sellers_aggregatesListingsAndWallet() {
        StorefrontListing l1 = listing(1L, 7L, "PUBLISHED");
        l1.setSoldCount(5);
        StorefrontListing l2 = listing(2L, 7L, "PAUSED");
        l2.setSoldCount(2);
        when(listingRepository.findAll()).thenReturn(List.of(l1, l2));
        PortalCustomerAccount seller = new PortalCustomerAccount();
        seller.setId(7L);
        seller.setDisplayName("duxury seller");
        seller.setContact("seller@example.com");
        when(accountRepository.findAll()).thenReturn(List.of(seller));
        SellerWallet wallet = new SellerWallet();
        wallet.setAccountId(7L);
        wallet.setAvailableBalance(new BigDecimal("100.00"));
        wallet.setPendingBalance(new BigDecimal("50.00"));
        wallet.setTotalEarned(new BigDecimal("300.00"));
        wallet.setTotalWithdrawn(new BigDecimal("150.00"));
        when(walletRepository.findAll()).thenReturn(List.of(wallet));

        List<AdminStorefrontSellerDto> sellers = adminStorefrontService.sellers();

        assertThat(sellers).hasSize(1);
        AdminStorefrontSellerDto dto = sellers.get(0);
        assertThat(dto.getListingCount()).isEqualTo(2);
        assertThat(dto.getPublishedCount()).isEqualTo(1);
        assertThat(dto.getSoldCount()).isEqualTo(7);
        assertThat(dto.getAvailableBalance()).isEqualByComparingTo("100.00");
        assertThat(dto.getPendingBalance()).isEqualByComparingTo("50.00");
        assertThat(dto.getTotalEarned()).isEqualByComparingTo("300.00");
    }

    @Test
    void nonAdminStaff_forbidden() {
        loginAs("SALES");

        assertThatThrownBy(() -> adminStorefrontService.listings(null, null))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
        assertThatThrownBy(() -> adminStorefrontService.pause(1L))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
        assertThatThrownBy(() -> adminStorefrontService.sellers())
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }
}
