package com.jewelry.system.service;

import com.jewelry.system.enums.ServiceType;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PortalDepositPricingTest {

    @Test
    void designerDepositIsUnitTimesPieceCount() {
        assertThat(PortalDepositPricing.total(ServiceType.DESIGNER_DESIGN, 1))
                .isEqualByComparingTo("199.00");
        assertThat(PortalDepositPricing.total(ServiceType.DESIGNER_DESIGN, 4))
                .isEqualByComparingTo("796.00");
    }

    @Test
    void customImageDepositIsUnitTimesPieceCount() {
        assertThat(PortalDepositPricing.total(ServiceType.CUSTOM_IMAGE, 1))
                .isEqualByComparingTo("99.00");
        assertThat(PortalDepositPricing.total(ServiceType.CUSTOM_IMAGE, 3))
                .isEqualByComparingTo("297.00");
    }

    @Test
    void missingPieceCountChargesOneUnit() {
        assertThat(PortalDepositPricing.total(ServiceType.DESIGNER_DESIGN, null))
                .isEqualByComparingTo("199.00");
    }

    @Test
    void rejectsPieceCountOutsideRange() {
        assertThatThrownBy(() -> PortalDepositPricing.normalizePieceCount(0))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> PortalDepositPricing.normalizePieceCount(6))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void rejectsServiceWithoutUnitPrice() {
        assertThatThrownBy(() -> PortalDepositPricing.unitPrice(ServiceType.B2B_MODEL))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> PortalDepositPricing.unitPrice(null))
                .isInstanceOf(ResponseStatusException.class);
    }
}
