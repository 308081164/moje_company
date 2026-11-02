package com.jewelry.system.storefront;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.storefront.StorefrontProcessLineDto;
import com.jewelry.system.dto.storefront.StorefrontStoneLineDto;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** 独立站商品详情：配石 / 工艺 JSON → 买家可读条目 */
public final class StorefrontSpecFormatter {

    private StorefrontSpecFormatter() {
    }

    public static List<StorefrontStoneLineDto> parseStones(ObjectMapper mapper, String json) {
        List<StorefrontStoneLineDto> rows = new ArrayList<>();
        JsonNode arr = toArray(mapper, json);
        if (arr == null) {
            return rows;
        }
        for (JsonNode node : arr) {
            if (node == null || !node.isObject()) {
                continue;
            }
            String type = stoneTypeLabel(text(node.get("stoneType")));
            String shape = stoneShapeLabel(text(node.get("shape")));
            String size = nv(text(node.get("size")));
            String qty = numberOrText(node.get("quantity"));
            String weight = numberOrText(node.get("weight"));
            String notes = nv(text(node.get("notes")));
            if (!StringUtils.hasText(type) && !StringUtils.hasText(shape) && !StringUtils.hasText(size)
                    && !StringUtils.hasText(notes)) {
                continue;
            }
            rows.add(StorefrontStoneLineDto.builder()
                    .stoneType(type)
                    .shape(shape)
                    .size(size)
                    .quantity(qty)
                    .weight(weight)
                    .notes(notes)
                    .build());
        }
        return rows;
    }

    public static List<StorefrontProcessLineDto> parseProcesses(ObjectMapper mapper, String json) {
        List<StorefrontProcessLineDto> rows = new ArrayList<>();
        JsonNode arr = toArray(mapper, json);
        if (arr == null) {
            return rows;
        }
        for (JsonNode node : arr) {
            if (node == null || !node.isObject()) {
                continue;
            }
            String custom = text(node.get("customProcess"));
            String name = StringUtils.hasText(custom) ? custom.trim() : processTypeLabel(text(node.get("processType")));
            String notes = nv(text(node.get("notes")));
            if (!StringUtils.hasText(name) && !StringUtils.hasText(notes)) {
                continue;
            }
            rows.add(StorefrontProcessLineDto.builder()
                    .name(name)
                    .notes(notes)
                    .build());
        }
        return rows;
    }

    private static JsonNode toArray(ObjectMapper mapper, String json) {
        if (!StringUtils.hasText(json)) {
            return null;
        }
        try {
            JsonNode root = mapper.readTree(json);
            if (root == null || root.isNull()) {
                return null;
            }
            return root.isArray() ? root : mapper.createArrayNode().add(root);
        } catch (Exception e) {
            return null;
        }
    }

    private static String text(JsonNode node) {
        if (node == null || node.isNull()) {
            return "";
        }
        return node.asText("").trim();
    }

    private static String nv(String v) {
        return StringUtils.hasText(v) ? v.trim() : "";
    }

    private static String numberOrText(JsonNode node) {
        if (node == null || node.isNull()) {
            return "";
        }
        if (node.isNumber()) {
            double d = node.asDouble();
            if (d == Math.rint(d)) {
                return String.valueOf((long) d);
            }
            return String.format(Locale.ROOT, "%.3f", d);
        }
        return nv(node.asText());
    }

    private static String processTypeLabel(String processType) {
        if (!StringUtils.hasText(processType)) {
            return "";
        }
        return switch (processType.trim().toUpperCase(Locale.ROOT)) {
            case "ENAMEL" -> "珐琅";
            case "WIRE_DRAWING" -> "拉丝";
            case "SAND_BLASTING" -> "喷砂";
            case "NAIL_SAND" -> "钉砂";
            case "OTHER" -> "其他工艺";
            default -> processType.trim();
        };
    }

    private static String stoneTypeLabel(String stoneType) {
        if (!StringUtils.hasText(stoneType)) {
            return "";
        }
        return switch (stoneType.trim().toUpperCase(Locale.ROOT)) {
            case "DIAMOND" -> "钻石";
            case "RUBY" -> "红宝石";
            case "SAPPHIRE" -> "蓝宝石";
            case "EMERALD" -> "祖母绿";
            case "JADE" -> "玉石";
            case "PEARL" -> "珍珠";
            case "CRYSTAL" -> "水晶";
            case "CZ" -> "锆石";
            case "MOISSANITE" -> "莫桑钻";
            case "LAB_DIAMOND" -> "培育钻";
            case "OTHER" -> "其他";
            default -> stoneType.trim();
        };
    }

    private static String stoneShapeLabel(String shape) {
        if (!StringUtils.hasText(shape)) {
            return "";
        }
        return switch (shape.trim().toUpperCase(Locale.ROOT)) {
            case "ROUND" -> "圆形";
            case "OVAL" -> "椭圆形";
            case "PEAR" -> "梨形";
            case "MARQUISE" -> "马眼形";
            case "HEART" -> "心形";
            case "PRINCESS" -> "公主方形";
            case "CUSHION" -> "垫形";
            case "RADIANT" -> "雷迪恩形";
            case "OTHER" -> "其他";
            default -> shape.trim();
        };
    }
}
