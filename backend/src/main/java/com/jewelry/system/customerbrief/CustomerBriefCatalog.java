package com.jewelry.system.customerbrief;

import com.jewelry.system.dto.portal.CustomerBriefSubmitRequest;
import com.jewelry.system.enums.JewelryType;
import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 定金环节的金属，以及下单后定制问卷的可选项与校验。
 */
public final class CustomerBriefCatalog {

    public static final Set<String> METALS = Set.of(
            "SILVER_925", "PURE_SILVER", "PURE_GOLD", "PLATINUM_950",
            "K9", "K14", "K18", "K_OTHER", "COPPER", "OTHER");

    public static final Set<String> BUDGETS = Set.of(
            "UNDER_5K", "FROM_5K_10K", "FROM_10K_30K", "OVER_30K", "UNSURE");

    public static final Set<String> RING_UNITS = Set.of(
            "HK", "US", "EU", "UK", "OTHER", "INNER_MM");

    public static final Set<String> CHAIN_STYLES = Set.of(
            "O", "CROSS", "CHOPARD", "WAVE", "TWIST", "BOX", "BEAD",
            "SNAKE", "CURB", "DIAMOND_CUT", "STAR", "OTHER");

    public static final Set<String> BRACELET_MEASURES = Set.of(
            "CLOSED_MM", "EUROPE_CM", "OPEN_WRIST_CM");

    public static final Set<String> HAIR_KINDS = Set.of("CLIP", "PIN", "CHAIN", "OTHER");

    public static final Set<String> PLATING = Set.of(
            "NONE", "WHITE", "YELLOW", "ROSE", "SPLIT", "OTHER");

    public static final Set<String> INLAY = Set.of("NO", "YES", "DESIGNER");

    public static final Set<String> STONES = Set.of(
            "CZ", "MOISSANITE", "SYN_CORUNDUM", "SYN_SPINEL", "GLASS", "LAB_DIAMOND", "OTHER");

    public static final Set<String> COLORS = Set.of(
            "COLORLESS", "YELLOW", "PINK", "BLUE", "GREEN", "RED", "BLACK", "MULTI", "OTHER");

    private static final Map<String, String> METAL_LABELS = Map.ofEntries(
            Map.entry("SILVER_925", "925银"),
            Map.entry("PURE_SILVER", "足银999"),
            Map.entry("PURE_GOLD", "足金"),
            Map.entry("PLATINUM_950", "铂金950"),
            Map.entry("K9", "9K"),
            Map.entry("K14", "14K"),
            Map.entry("K18", "18K"),
            Map.entry("K_OTHER", "K金（其他）"),
            Map.entry("K_GOLD", "K金"),
            Map.entry("COPPER", "铜"),
            Map.entry("OTHER", "其他"));

    private CustomerBriefCatalog() {
    }

    public static String requireMetal(String raw) {
        String code = normalize(raw);
        if (!METALS.contains(code)) {
            throw bad("请选择金属材质");
        }
        return code;
    }

    public static String materialLabel(String raw) {
        String code = normalize(raw);
        if (!StringUtils.hasText(code)) {
            return "";
        }
        return METAL_LABELS.getOrDefault(code, raw.trim());
    }

    /** 未选择金属时仍允许问卷询问镶石；只有足金、足银明确排除。 */
    public static boolean allowsInlay(String raw) {
        String code = normalize(raw);
        if (!StringUtils.hasText(code) || !METALS.contains(code)) {
            return true;
        }
        return !"PURE_GOLD".equals(code) && !"PURE_SILVER".equals(code);
    }

    public static void validate(String metalCode, String budgetBand,
                                List<CustomerBriefSubmitRequest.Piece> pieces,
                                Set<Long> expectedPieceIds) {
        if (!StringUtils.hasText(budgetBand) || budgetBand.trim().length() > 80) {
            throw bad("请填写成品预算");
        }
        if (pieces == null || expectedPieceIds == null || pieces.size() != expectedPieceIds.size()) {
            throw bad("请为每一件填写问卷");
        }
        boolean inlayAllowed = allowsInlay(metalCode);
        Set<Long> seen = new HashSet<>();
        for (CustomerBriefSubmitRequest.Piece piece : pieces) {
            if (piece == null || piece.getPieceId() == null || !expectedPieceIds.contains(piece.getPieceId())
                    || !seen.add(piece.getPieceId())) {
                throw bad("问卷单件与订单不一致");
            }
            JewelryType type = JewelryType.parse(piece.getJewelryType());
            if (type == null) {
                throw bad("请选择每一件的品类");
            }
            switch (type) {
                case RING -> {
                    if (!RING_UNITS.contains(normalize(piece.getRingUnit())) || !StringUtils.hasText(piece.getRingSize())) {
                        throw bad("戒指请填写圈号，并选择单位");
                    }
                    piece.setRingSize(trim(piece.getRingSize(), 40));
                }
                case NECKLACE -> {
                    if (piece.getWithChain() == null) {
                        throw bad("项链请选择是否配链");
                    }
                    if (Boolean.TRUE.equals(piece.getWithChain()) && !CHAIN_STYLES.contains(normalize(piece.getChainStyle()))) {
                        throw bad("请选择链子样式");
                    }
                }
                case COLLARBONE -> {
                    if (!CHAIN_STYLES.contains(normalize(piece.getChainStyle()))) {
                        throw bad("请选择锁骨链样式");
                    }
                }
                case BRACELET -> {
                    if (!BRACELET_MEASURES.contains(normalize(piece.getBraceletMeasure()))
                            || !StringUtils.hasText(piece.getBraceletValue())) {
                        throw bad("手镯请选择圈口量法并填写尺寸");
                    }
                    piece.setBraceletValue(trim(piece.getBraceletValue(), 40));
                }
                case HAIR -> {
                    if (!HAIR_KINDS.contains(normalize(piece.getHairKind()))) {
                        throw bad("请选择发饰种类");
                    }
                }
                default -> {
                    // 胸针、耳饰、小挂件、其他没有额外尺寸
                }
            }
            if (!PLATING.contains(normalize(piece.getPlating()))) {
                throw bad("请选择是否需要电镀");
            }
            if (!"YES".equals(normalize(piece.getEnamel())) && !"NO".equals(normalize(piece.getEnamel()))) {
                throw bad("请选择是否需要珐琅");
            }
            if (!inlayAllowed) {
                if (StringUtils.hasText(piece.getInlay()) && !"NO".equals(normalize(piece.getInlay()))) {
                    throw bad("足金和足银无法做宝石镶嵌");
                }
                piece.setInlay("NO");
                piece.setStoneCategory(null);
                piece.setStoneColor(null);
            } else if (!INLAY.contains(normalize(piece.getInlay()))) {
                throw bad("请选择是否镶嵌石头");
            } else if ("YES".equals(normalize(piece.getInlay()))) {
                if (!STONES.contains(normalize(piece.getStoneCategory())) || !COLORS.contains(normalize(piece.getStoneColor()))) {
                    throw bad("请选择石头品类和颜色，或改为让设计师决定");
                }
            } else {
                piece.setStoneCategory(null);
                piece.setStoneColor(null);
            }
            piece.setJewelryType(type.name());
            piece.setRingUnit(normalize(piece.getRingUnit()));
            piece.setChainStyle(normalize(piece.getChainStyle()));
            piece.setBraceletMeasure(normalize(piece.getBraceletMeasure()));
            piece.setHairKind(normalize(piece.getHairKind()));
            piece.setPlating(normalize(piece.getPlating()));
            piece.setEnamel(normalize(piece.getEnamel()));
            piece.setInlay(normalize(piece.getInlay()));
            piece.setStoneCategory(normalize(piece.getStoneCategory()));
            piece.setStoneColor(normalize(piece.getStoneColor()));
        }
    }

    public static String budgetLabel(String band) {
        if (!StringUtils.hasText(band)) {
            return "";
        }
        return switch (normalize(band)) {
            case "UNDER_5K" -> "5,000 元以内";
            case "FROM_5K_10K" -> "5,000–10,000 元";
            case "FROM_10K_30K" -> "10,000–30,000 元";
            case "OVER_30K" -> "30,000 元以上";
            case "UNSURE" -> "还不确定，请按效果建议";
            default -> band.trim();
        };
    }

    public static String platingLabel(String plating) {
        return switch (normalize(plating)) {
            case "NONE" -> "不需要电镀";
            case "WHITE" -> "电镀：白";
            case "YELLOW" -> "电镀：黄";
            case "ROSE" -> "电镀：玫瑰金（红）";
            case "SPLIT" -> "电镀：分色";
            case "OTHER" -> "电镀：其他";
            default -> "";
        };
    }

    public static String summarizePiece(CustomerBriefSubmitRequest.Piece piece) {
        if (piece == null) {
            return "";
        }
        JewelryType type = JewelryType.parse(piece.getJewelryType());
        StringBuilder sb = new StringBuilder(typeLabel(type));
        switch (type == null ? JewelryType.OTHER : type) {
            case RING -> sb.append("，圈号 ").append(unitLabel(piece.getRingUnit())).append(" ").append(empty(piece.getRingSize()));
            case NECKLACE -> {
                if (Boolean.TRUE.equals(piece.getWithChain())) {
                    sb.append("，配链：").append(chainLabel(piece.getChainStyle()));
                } else {
                    sb.append("，不配链");
                }
            }
            case COLLARBONE -> sb.append("，样式：").append(chainLabel(piece.getChainStyle()));
            case BRACELET -> sb.append("，").append(braceletMeasureLabel(piece.getBraceletMeasure()))
                    .append(" ").append(empty(piece.getBraceletValue()));
            case HAIR -> sb.append("，").append(hairLabel(piece.getHairKind()));
            default -> {
            }
        }
        String plating = platingLabel(piece.getPlating());
        if (StringUtils.hasText(plating)) {
            sb.append("；").append(plating);
        }
        sb.append("；珐琅：").append("YES".equals(normalize(piece.getEnamel())) ? "需要" : "不需要");
        sb.append("；镶石：").append(inlayLabel(piece));
        return sb.toString();
    }

    public static String sizeSummary(List<CustomerBriefSubmitRequest.Piece> pieces, Map<Long, String> names) {
        if (pieces == null || pieces.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (CustomerBriefSubmitRequest.Piece piece : pieces) {
            String size = sizeOnly(piece);
            if (!StringUtils.hasText(size)) {
                continue;
            }
            if (!sb.isEmpty()) {
                sb.append("；");
            }
            String name = names.getOrDefault(piece.getPieceId(), "单件");
            sb.append(name).append("：").append(size);
        }
        String text = sb.toString();
        return text.length() > 500 ? text.substring(0, 500) : text;
    }

    public static String typeLabel(JewelryType type) {
        if (type == null) {
            return "未选品类";
        }
        return switch (type) {
            case RING -> "戒指";
            case NECKLACE -> "项链";
            case EARRING -> "耳钉/耳饰";
            case BROOCH -> "胸针";
            case BRACELET -> "手镯";
            case COLLARBONE -> "锁骨链";
            case HAIR -> "发饰";
            case CHARM -> "小挂件";
            case OTHER -> "其他";
        };
    }

    private static String sizeOnly(CustomerBriefSubmitRequest.Piece piece) {
        JewelryType type = JewelryType.parse(piece.getJewelryType());
        if (type == null) {
            return "";
        }
        return switch (type) {
            case RING -> unitLabel(piece.getRingUnit()) + " " + empty(piece.getRingSize());
            case NECKLACE -> Boolean.TRUE.equals(piece.getWithChain())
                    ? "配链 " + chainLabel(piece.getChainStyle()) : "不配链";
            case COLLARBONE -> chainLabel(piece.getChainStyle());
            case BRACELET -> braceletMeasureLabel(piece.getBraceletMeasure()) + " " + empty(piece.getBraceletValue());
            case HAIR -> hairLabel(piece.getHairKind());
            default -> "";
        };
    }

    private static String inlayLabel(CustomerBriefSubmitRequest.Piece piece) {
        return switch (normalize(piece.getInlay())) {
            case "YES" -> stoneLabel(piece.getStoneCategory()) + " / " + colorLabel(piece.getStoneColor());
            case "DESIGNER" -> "让设计师决定";
            default -> "不镶石";
        };
    }

    private static String unitLabel(String unit) {
        return switch (normalize(unit)) {
            case "HK" -> "港码";
            case "US" -> "美码";
            case "EU" -> "欧码";
            case "UK" -> "英码";
            case "INNER_MM" -> "内径mm";
            case "OTHER" -> "其他单位";
            default -> "";
        };
    }

    private static String chainLabel(String style) {
        return switch (normalize(style)) {
            case "O" -> "O字链";
            case "CROSS" -> "十字链";
            case "CHOPARD" -> "肖邦链";
            case "WAVE" -> "水波链";
            case "TWIST" -> "绞丝链";
            case "BOX" -> "盒仔链";
            case "BEAD" -> "珠珠链";
            case "SNAKE" -> "蛇骨链";
            case "CURB" -> "侧身链";
            case "DIAMOND_CUT" -> "车花链";
            case "STAR" -> "满天星";
            case "OTHER" -> "其他";
            default -> "";
        };
    }

    private static String braceletMeasureLabel(String measure) {
        return switch (normalize(measure)) {
            case "CLOSED_MM" -> "闭口硬镯内径mm";
            case "EUROPE_CM" -> "欧式硬镯周长cm";
            case "OPEN_WRIST_CM" -> "开口手链腕围cm（另加1.5～2cm余量）";
            default -> "";
        };
    }

    private static String hairLabel(String kind) {
        return switch (normalize(kind)) {
            case "CLIP" -> "发夹";
            case "PIN" -> "簪子";
            case "CHAIN" -> "发链";
            case "OTHER" -> "其他发饰";
            default -> "";
        };
    }

    private static String stoneLabel(String stone) {
        return switch (normalize(stone)) {
            case "CZ" -> "锆石";
            case "MOISSANITE" -> "莫桑钻";
            case "SYN_CORUNDUM" -> "合成刚玉";
            case "SYN_SPINEL" -> "合成尖晶";
            case "GLASS" -> "玻璃";
            case "LAB_DIAMOND" -> "培育钻";
            case "OTHER" -> "其他石头";
            default -> "";
        };
    }

    private static String colorLabel(String color) {
        return switch (normalize(color)) {
            case "COLORLESS" -> "无色";
            case "YELLOW" -> "黄";
            case "PINK" -> "粉";
            case "BLUE" -> "蓝";
            case "GREEN" -> "绿";
            case "RED" -> "红";
            case "BLACK" -> "黑";
            case "MULTI" -> "多色";
            case "OTHER" -> "其他颜色";
            default -> "";
        };
    }

    private static String normalize(String raw) {
        return StringUtils.hasText(raw) ? raw.trim().toUpperCase(Locale.ROOT) : "";
    }

    private static String trim(String raw, int max) {
        String text = raw.trim();
        return text.length() > max ? text.substring(0, max) : text;
    }

    private static String empty(String raw) {
        return raw == null ? "" : raw.trim();
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
