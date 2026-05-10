package com.jewelry.system.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CustomerOrderViewServiceMaskTest {

    @Test
    void maskCustomerName_nullOrBlank_returnsNull() {
        assertThat(CustomerOrderViewService.maskCustomerName(null)).isNull();
        assertThat(CustomerOrderViewService.maskCustomerName("  ")).isNull();
    }

    @Test
    void maskCustomerName_short_masks() {
        assertThat(CustomerOrderViewService.maskCustomerName("张")).isEqualTo("*");
        assertThat(CustomerOrderViewService.maskCustomerName("张三")).isEqualTo("张**");
        assertThat(CustomerOrderViewService.maskCustomerName("欧阳修文")).isEqualTo("欧**");
    }
}
