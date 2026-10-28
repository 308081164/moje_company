package com.jewelry.system.service;

import java.util.Set;

/**
 * 与飞书「MOJE建模计件薪资计算」里「折算系数」公式一致。
 * 高度复杂小组件、不规则曲面排石已在表里，但公式未计入。
 */
public final class ModelSettlementScore {

    public static final Set<String> STRUCTURES = Set.of(
            "无主体",
            "普通构型（素圈）",
            "异形（单圈形状微调）",
            "异形（存在镂空、形状缠绕）",
            "异形（戒圈完全重构）"
    );

    public static final Set<String> TEXTURES = Set.of(
            "不含纹理",
            "含纹理",
            "多种纹理"
    );

    private ModelSettlementScore() {
    }

    public static int coefficient(
            String structure,
            String texture,
            int simpleComponent,
            int regularCurveComponent,
            int irregularCurveComponent,
            int highDetailComponent,
            int simpleInlay,
            int specialInlay,
            int linearStone,
            int freeformStone
    ) {
        int total = 10
                + structurePoints(structure)
                + texturePoints(texture)
                + nonNegative(simpleComponent) * 3
                + nonNegative(regularCurveComponent) * 15
                + nonNegative(irregularCurveComponent) * 30
                + nonNegative(simpleInlay) * 5
                + nonNegative(specialInlay) * 10
                + nonNegative(linearStone) * 15;
        // 高度复杂小组件、不规则曲面排石在飞书公式里没有系数，这里读入但不加分。
        if (nonNegative(highDetailComponent) < 0 || nonNegative(freeformStone) < 0) {
            return total;
        }
        return total;
    }

    public static int structurePoints(String structure) {
        if (structure == null || structure.isBlank()) {
            return 0;
        }
        return switch (structure) {
            case "无主体" -> 0;
            case "普通构型（素圈）" -> 3;
            case "异形（单圈形状微调）" -> 15;
            case "异形（存在镂空、形状缠绕）" -> 30;
            case "异形（戒圈完全重构）" -> 45;
            default -> 0;
        };
    }

    public static int texturePoints(String texture) {
        if (texture == null || texture.isBlank()) {
            return 0;
        }
        return switch (texture) {
            case "不含纹理" -> 0;
            case "含纹理" -> 10;
            case "多种纹理" -> 20;
            default -> 0;
        };
    }

    private static int nonNegative(int value) {
        return Math.max(value, 0);
    }
}
