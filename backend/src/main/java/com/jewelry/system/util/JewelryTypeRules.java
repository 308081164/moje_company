package com.jewelry.system.util;

import com.jewelry.system.customerbrief.CustomerBriefCatalog;
import com.jewelry.system.dto.storefront.StorefrontPurchaseRequest;
import com.jewelry.system.enums.JewelryType;
import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

public final class JewelryTypeRules {

    private JewelryTypeRules() {
    }

    public static void requireTypeSet(JewelryType type) {
        if (type == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请先选择珠宝类型");
        }
    }

    public static void validateDesignerHandSize(JewelryType type, String handSize) {
        requireTypeSet(type);
        boolean has = StringUtils.hasText(handSize);
        if (type.requiresHandSize() && !has) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "戒指须填写手寸");
        }
    }

    public static void validateBuyerSize(JewelryType type, String buyerSize) {
        if (type == null) {
            return;
        }
        boolean has = StringUtils.hasText(buyerSize);
        if (type.requiresHandSize() && !has) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "购买戒指须填写手寸");
        }
    }

    /**
     * 独立站商城购买时的品类规格校验，并把规范化后的值写回 request。
     *
     * @return 写入订单备注的规格摘要（可为空）
     */
    public static String validateAndSummarizeBuyerOptions(JewelryType type, StorefrontPurchaseRequest req) {
        if (type == null || req == null) {
            validateBuyerSize(type, req != null ? req.getBuyerSize() : null);
            return summarizeLegacy(req);
        }
        return switch (type) {
            case RING -> {
                String unit = normalize(req.getRingUnit());
                if (!CustomerBriefCatalog.RING_UNITS.contains(unit) || !StringUtils.hasText(req.getBuyerSize())) {
                    throw bad("购买戒指须选择圈号单位并填写手寸");
                }
                req.setRingUnit(unit);
                req.setBuyerSize(trim(req.getBuyerSize(), 40));
                yield unitLabel(unit) + " " + req.getBuyerSize();
            }
            case NECKLACE -> {
                if (req.getWithChain() == null) {
                    throw bad("请选择是否配链");
                }
                StringBuilder sb = new StringBuilder();
                if (Boolean.TRUE.equals(req.getWithChain())) {
                    String style = normalize(req.getChainStyle());
                    if (!CustomerBriefCatalog.CHAIN_STYLES.contains(style)) {
                        throw bad("请选择配链类型");
                    }
                    req.setChainStyle(style);
                    sb.append("配链 ").append(chainLabel(style));
                } else {
                    req.setChainStyle(null);
                    sb.append("不配链");
                }
                if (StringUtils.hasText(req.getChainLength())) {
                    req.setChainLength(trim(req.getChainLength(), 40));
                    sb.append("，链长 ").append(req.getChainLength());
                }
                if (StringUtils.hasText(req.getBuyerSize()) && !StringUtils.hasText(req.getChainLength())) {
                    req.setChainLength(trim(req.getBuyerSize(), 40));
                    sb.append("，链长 ").append(req.getChainLength());
                }
                yield sb.toString();
            }
            case COLLARBONE -> {
                String style = normalize(req.getChainStyle());
                if (!CustomerBriefCatalog.CHAIN_STYLES.contains(style)) {
                    throw bad("请选择锁骨链样式");
                }
                req.setWithChain(true);
                req.setChainStyle(style);
                StringBuilder sb = new StringBuilder(chainLabel(style));
                if (StringUtils.hasText(req.getChainLength()) || StringUtils.hasText(req.getBuyerSize())) {
                    String len = StringUtils.hasText(req.getChainLength())
                            ? trim(req.getChainLength(), 40) : trim(req.getBuyerSize(), 40);
                    req.setChainLength(len);
                    sb.append("，链长 ").append(len);
                }
                yield sb.toString();
            }
            case BRACELET -> {
                String measure = normalize(req.getBraceletMeasure());
                if (!CustomerBriefCatalog.BRACELET_MEASURES.contains(measure)
                        || !StringUtils.hasText(req.getBuyerSize())) {
                    throw bad("购买手镯/手链须选择量法并填写尺寸");
                }
                req.setBraceletMeasure(measure);
                req.setBuyerSize(trim(req.getBuyerSize(), 40));
                yield braceletMeasureLabel(measure) + " " + req.getBuyerSize();
            }
            default -> {
                if (StringUtils.hasText(req.getBuyerSize())) {
                    req.setBuyerSize(trim(req.getBuyerSize(), 40));
                    yield req.getBuyerSize();
                }
                yield "";
            }
        };
    }

    /** 买家下单时是否应展示规格输入 */
    public static boolean buyerNeedsSizeInput(JewelryType type) {
        if (type == null) {
            return false;
        }
        return switch (type) {
            case RING, NECKLACE, BRACELET, COLLARBONE -> true;
            default -> false;
        };
    }

    public static boolean buyerSizeRequired(JewelryType type) {
        if (type == null) {
            return false;
        }
        return switch (type) {
            case RING, NECKLACE, BRACELET, COLLARBONE -> true;
            default -> false;
        };
    }

    private static String summarizeLegacy(StorefrontPurchaseRequest req) {
        if (req == null || !StringUtils.hasText(req.getBuyerSize())) {
            return "";
        }
        return req.getBuyerSize().trim();
    }

    private static String normalize(String raw) {
        return raw == null ? "" : raw.trim().toUpperCase();
    }

    private static String trim(String raw, int max) {
        String v = raw == null ? "" : raw.trim();
        return v.length() > max ? v.substring(0, max) : v;
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static String unitLabel(String unit) {
        return switch (unit) {
            case "HK" -> "港码";
            case "US" -> "美码";
            case "EU" -> "欧码";
            case "UK" -> "英码";
            case "INNER_MM" -> "内径mm";
            case "OTHER" -> "其他单位";
            default -> unit;
        };
    }

    private static String chainLabel(String style) {
        return switch (style) {
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
            default -> style;
        };
    }

    private static String braceletMeasureLabel(String measure) {
        return switch (measure) {
            case "CLOSED_MM" -> "闭口内径mm";
            case "EUROPE_CM" -> "欧洲圈号cm";
            case "OPEN_WRIST_CM" -> "开口腕围cm";
            default -> measure;
        };
    }
}
