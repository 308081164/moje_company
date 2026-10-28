package com.jewelry.system.customerbrief;

import com.jewelry.system.dto.portal.CustomerBriefSubmitRequest;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CustomerBriefCatalogTest {

    @Test
    void pureMetalsCannotTakeStones() {
        assertFalse(CustomerBriefCatalog.allowsInlay("PURE_GOLD"));
        assertFalse(CustomerBriefCatalog.allowsInlay("PURE_SILVER"));
        assertTrue(CustomerBriefCatalog.allowsInlay("SILVER_925"));
        assertTrue(CustomerBriefCatalog.allowsInlay("K18"));
        assertEquals("足银999", CustomerBriefCatalog.materialLabel("PURE_SILVER"));
    }

    @Test
    void ringBriefRequiresSizeAndRejectsInlayOnPureGold() {
        CustomerBriefSubmitRequest.Piece piece = ring();
        piece.setInlay("YES");
        piece.setStoneCategory("CZ");
        piece.setStoneColor("COLORLESS");
        assertThrows(ResponseStatusException.class,
                () -> CustomerBriefCatalog.validate("PURE_GOLD", "UNDER_5K", List.of(piece), Set.of(1L)));
    }

    @Test
    void necklaceCanSkipChainAndAskDesignerForStones() {
        CustomerBriefSubmitRequest.Piece piece = base();
        piece.setPieceId(7L);
        piece.setJewelryType("NECKLACE");
        piece.setWithChain(false);
        piece.setInlay("DESIGNER");
        CustomerBriefCatalog.validate("K18", "8000元", List.of(piece), Set.of(7L));
        assertTrue(CustomerBriefCatalog.summarizePiece(piece).contains("不配链"));
        assertTrue(CustomerBriefCatalog.summarizePiece(piece).contains("让设计师决定"));
    }

    private static CustomerBriefSubmitRequest.Piece ring() {
        CustomerBriefSubmitRequest.Piece piece = base();
        piece.setJewelryType("RING");
        piece.setRingUnit("HK");
        piece.setRingSize("12");
        return piece;
    }

    private static CustomerBriefSubmitRequest.Piece base() {
        CustomerBriefSubmitRequest.Piece piece = new CustomerBriefSubmitRequest.Piece();
        piece.setPieceId(1L);
        piece.setPlating("WHITE");
        piece.setEnamel("NO");
        piece.setInlay("NO");
        return piece;
    }
}
