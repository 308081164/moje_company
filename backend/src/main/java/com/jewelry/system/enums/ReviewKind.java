package com.jewelry.system.enums;

public enum ReviewKind {
    DESIGN,
    MODEL;

    public static ReviewKind fromString(String raw) {
        if (raw == null || raw.isBlank()) {
            return MODEL;
        }
        for (ReviewKind k : values()) {
            if (k.name().equalsIgnoreCase(raw.trim())) {
                return k;
            }
        }
        throw new IllegalArgumentException("未知评审类型: " + raw);
    }
}