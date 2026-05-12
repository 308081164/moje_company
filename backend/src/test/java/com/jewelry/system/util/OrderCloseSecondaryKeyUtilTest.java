package com.jewelry.system.util;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OrderCloseSecondaryKeyUtilTest {

    @Test
    void example20260512_is1342() {
        LocalDate d = LocalDate.of(2026, 5, 12);
        assertEquals("1342", OrderCloseSecondaryKeyUtil.expectedKey(d));
        assertTrue(OrderCloseSecondaryKeyUtil.matches("1342", d));
        assertTrue(OrderCloseSecondaryKeyUtil.matches(" 1342 ", d));
    }
}
