package com.jewelry.system.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.entity.OrderPiece;
import com.jewelry.system.enums.JewelryType;
import com.jewelry.system.repository.DesignInfoRepository;
import com.jewelry.system.repository.ModelingInfoRepository;
import com.jewelry.system.repository.OrderPieceRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.BeforeEach;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderPieceServiceTest {

    @Mock
    private OrderPieceRepository orderPieceRepository;

    @Mock
    private DesignInfoRepository designInfoRepository;

    @Mock
    private ModelingInfoRepository modelingInfoRepository;

    private OrderPieceService orderPieceService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        orderPieceService = new OrderPieceService(
                orderPieceRepository, designInfoRepository, modelingInfoRepository, objectMapper);
    }

    @Test
    void createPieceRejectsWhenAtLimit() {
        when(orderPieceRepository.countByOrderId(1L)).thenReturn(5);
        assertThrows(ResponseStatusException.class, () -> orderPieceService.createPiece(1L, "男戒", JewelryType.RING));
    }

    @Test
    void allDesignConfirmedRequiresEveryPiece() {
        OrderPieceService svc = new OrderPieceService(
                orderPieceRepository, designInfoRepository, modelingInfoRepository, objectMapper);
        OrderPiece a = new OrderPiece();
        a.setDesignConfirmed(true);
        OrderPiece b = new OrderPiece();
        b.setDesignConfirmed(false);
        when(orderPieceRepository.findByOrderIdOrderBySeqAsc(9L)).thenReturn(List.of(a, b));
        org.junit.jupiter.api.Assertions.assertFalse(svc.allDesignConfirmed(9L));
    }

    @Test
    void initializePiecesForOrderRejectsInvalidCount() {
        assertThrows(ResponseStatusException.class, () -> orderPieceService.initializePiecesForOrder(1L, 0));
        assertThrows(ResponseStatusException.class, () -> orderPieceService.initializePiecesForOrder(1L, 6));
    }

    @Test
    void initializePiecesForOrderIsIdempotentWhenPiecesExist() {
        OrderPiece existing = new OrderPiece();
        existing.setId(1L);
        existing.setName("主件");
        when(orderPieceRepository.findByOrderIdOrderBySeqAsc(4L)).thenReturn(List.of(existing));
        var list = orderPieceService.initializePiecesForOrder(4L, 3);
        assertEquals(1, list.size());
        assertEquals("主件", list.get(0).getName());
    }

    @Test
    void ensureDefaultPieceCreatesWhenMissing() {
        when(orderPieceRepository.findByOrderIdOrderBySeqAsc(2L)).thenReturn(List.of());
        when(orderPieceRepository.save(any())).thenAnswer(inv -> {
            OrderPiece p = inv.getArgument(0);
            p.setId(100L);
            return p;
        });
        OrderPiece piece = orderPieceService.ensureDefaultPiece(2L);
        assertEquals("主件", piece.getName());
        assertEquals(1, piece.getSeq());
    }
}
