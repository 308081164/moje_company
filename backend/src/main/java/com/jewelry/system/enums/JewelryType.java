package com.jewelry.system.enums;

import org.springframework.util.StringUtils;

/**
 * 单件珠宝类型，决定手寸/链长等规格字段是否必填。
 */
public enum JewelryType {
    RING,
    NECKLACE,
    EARRING,
    BROOCH,
    BRACELET,
    COLLARBONE,
    HAIR,
    CHARM,
    OTHER;

    public static JewelryType parse(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        try {
            return JewelryType.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public boolean requiresHandSize() {
        return this == RING;
    }

    public boolean allowsOptionalLength() {
        return this == NECKLACE || this == BRACELET || this == COLLARBONE;
    }

    public boolean hasNoSizeField() {
        return this == EARRING || this == BROOCH || this == HAIR || this == CHARM;
    }
}
