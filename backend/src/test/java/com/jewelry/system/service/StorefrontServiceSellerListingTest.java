package com.jewelry.system.service;

import com.jewelry.system.dto.storefront.StorefrontListingDto;
import com.jewelry.system.dto.storefront.StorefrontListingUpdateRequest;
import com.jewelry.system.entity.StorefrontListing;
import com.jewelry.system.repository.*;
import com.jewelry.system.security.AccountKind;
import com.jewelry.system.security.SecurityUserPrincipal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StorefrontServiceSellerListingTest {

    @Mock SysConfigRepository sysConfigRepository;
    @Mock StorefrontListingRepository listingRepository;
    @Mock OrderRepository orderRepository;
    @Mock PortalCustomerOrderBindingRepository bindingRepository;
    @Mock PortalCustomerAccountRepository accountRepository;
    @Mock DesignInfoRepository designInfoRepository;
    @Mock ModelingInfoRepository modelingInfoRepository;
    @Mock CustomerOrderViewService customerOrderViewService;
    @Mock OrderCommandService orderCommandService;
    @Mock AutoAssignmentService autoAssignmentService;
    @Mock ConversationService conversationService;
    @Mock OrderEventService orderEventService;
    @Mock StorefrontWalletService walletService;
    @Mock SellerWalletRepository walletRepository;
    @Mock SellerWithdrawRequestRepository withdrawRepository;
    @Mock ReferralService referralService;

    @InjectMocks
    StorefrontService storefrontService;

    @BeforeEach
    void loginAsSeller() {
        SecurityUserPrincipal principal = new SecurityUserPrincipal(7L, "seller@example.com", "C_PORTAL", AccountKind.C_PORTAL_CUSTOMER);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
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
        return l;
    }

    @Test
    void sellerListings_returnsOwnListings() {
        when(listingRepository.findBySellerAccountIdOrderByUpdatedAtDesc(7L))
                .thenReturn(List.of(listing(1L, 7L, "PUBLISHED"), listing(2L, 7L, "PAUSED")));

        List<StorefrontListingDto> result = storefrontService.sellerListings();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getStatus()).isEqualTo("PUBLISHED");
        assertThat(result.get(1).getStatus()).isEqualTo("PAUSED");
        assertThat(result.get(0).getSoldCount()).isEqualTo(3);
    }

    @Test
    void updateListing_ownerCanEditFields() {
        StorefrontListing existing = listing(1L, 7L, "PUBLISHED");
        when(listingRepository.findById(1L)).thenReturn(Optional.of(existing));

        StorefrontListingUpdateRequest req = new StorefrontListingUpdateRequest();
        req.setTitle("  新标题  ");
        req.setDescription("新的描述");
        req.setSalePrice(new BigDecimal("666"));
        req.setCoverImageUrl("https://oss.example/cover.png");

        StorefrontListingDto dto = storefrontService.updateListing(1L, req);

        verify(listingRepository).save(existing);
        assertThat(existing.getTitle()).isEqualTo("新标题");
        assertThat(existing.getDescription()).isEqualTo("新的描述");
        assertThat(existing.getSalePrice()).isEqualByComparingTo("666.00");
        assertThat(existing.getCoverImageUrl()).isEqualTo("https://oss.example/cover.png");
        assertThat(dto.getTitle()).isEqualTo("新标题");
    }

    @Test
    void updateListing_rejectsPriceBelowProductionQuote() {
        StorefrontListing existing = listing(1L, 7L, "PUBLISHED");
        when(listingRepository.findById(1L)).thenReturn(Optional.of(existing));

        StorefrontListingUpdateRequest req = new StorefrontListingUpdateRequest();
        req.setSalePrice(new BigDecimal("298.99"));

        assertThatThrownBy(() -> storefrontService.updateListing(1L, req))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(e.getReason()).contains("299");
                });
        verify(listingRepository, never()).save(any());
    }

    @Test
    void updateListing_rejectsNonPositivePrice() {
        StorefrontListing existing = listing(1L, 7L, "PUBLISHED");
        when(listingRepository.findById(1L)).thenReturn(Optional.of(existing));

        StorefrontListingUpdateRequest req = new StorefrontListingUpdateRequest();
        req.setSalePrice(BigDecimal.ZERO);

        assertThatThrownBy(() -> storefrontService.updateListing(1L, req))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(listingRepository, never()).save(any());
    }

    @Test
    void updateListing_rejectsBlankTitle() {
        StorefrontListing existing = listing(1L, 7L, "PUBLISHED");
        when(listingRepository.findById(1L)).thenReturn(Optional.of(existing));

        StorefrontListingUpdateRequest req = new StorefrontListingUpdateRequest();
        req.setTitle("   ");

        assertThatThrownBy(() -> storefrontService.updateListing(1L, req))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(listingRepository, never()).save(any());
    }

    @Test
    void updateListing_forbidsOtherSellersListing() {
        StorefrontListing existing = listing(1L, 99L, "PUBLISHED");
        when(listingRepository.findById(1L)).thenReturn(Optional.of(existing));

        StorefrontListingUpdateRequest req = new StorefrontListingUpdateRequest();
        req.setTitle("劫持标题");

        assertThatThrownBy(() -> storefrontService.updateListing(1L, req))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
        verify(listingRepository, never()).save(any());
    }

    @Test
    void republish_setsStatusBackToPublished() {
        StorefrontListing existing = listing(1L, 7L, "PAUSED");
        when(listingRepository.findById(1L)).thenReturn(Optional.of(existing));

        StorefrontListingDto dto = storefrontService.republish(1L);

        verify(listingRepository).save(existing);
        assertThat(existing.getStatus()).isEqualTo("PUBLISHED");
        assertThat(dto.getStatus()).isEqualTo("PUBLISHED");
    }
}
