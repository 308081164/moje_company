package com.jewelry.system.entity;

import com.jewelry.system.enums.OrderStatus;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * 与设计师保存设计后自动推进状态一致：PENDING_DESIGN 需先进入 DESIGNING 再进入 PENDING_MODEL。
 */
class OrderDesignerPhaseTransitionTest {

    @Test
    void pendingDesignToPendingModelUsesTwoSteps() {
        Order o = new Order();
        o.setStatus(OrderStatus.PENDING_DESIGN);
        o.transitionTo(OrderStatus.DESIGNING);
        o.transitionTo(OrderStatus.PENDING_MODEL);
        assertEquals(OrderStatus.PENDING_MODEL, o.getStatus());
        assertNotNull(o.getDesignCompletedTime());
    }

    @Test
    void pendingDesignCannotSkipToPendingModel() {
        Order o = new Order();
        o.setStatus(OrderStatus.PENDING_DESIGN);
        assertThrows(IllegalStateException.class, () -> o.transitionTo(OrderStatus.PENDING_MODEL));
    }

    @Test
    void designingToPendingModelSetsDesignCompletedTime() {
        Order o = new Order();
        o.setStatus(OrderStatus.DESIGNING);
        assertNull(o.getDesignCompletedTime());
        o.transitionTo(OrderStatus.PENDING_MODEL);
        assertEquals(OrderStatus.PENDING_MODEL, o.getStatus());
        assertNotNull(o.getDesignCompletedTime());
    }

    @Test
    void modelingCanRejectBackToDesigning() {
        Order o = new Order();
        o.setStatus(OrderStatus.MODELING);
        o.setDesignCompletedTime(java.time.LocalDateTime.now());
        o.setModelCompletedTime(java.time.LocalDateTime.now());
        o.transitionTo(OrderStatus.DESIGNING);
        assertEquals(OrderStatus.DESIGNING, o.getStatus());
        assertNull(o.getDesignCompletedTime());
        assertNull(o.getModelCompletedTime());
    }

    @Test
    void pendingModelCanRejectBackToDesigning() {
        Order o = new Order();
        o.setStatus(OrderStatus.PENDING_MODEL);
        o.setDesignCompletedTime(java.time.LocalDateTime.now());
        o.transitionTo(OrderStatus.DESIGNING);
        assertEquals(OrderStatus.DESIGNING, o.getStatus());
        assertNull(o.getDesignCompletedTime());
    }
}
