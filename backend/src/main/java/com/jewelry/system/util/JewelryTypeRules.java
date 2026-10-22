package com.jewelry.system.util;

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

    /** 买家下单时是否应展示规格输入 */
    public static boolean buyerNeedsSizeInput(JewelryType type) {
        return type != null && !type.hasNoSizeField();
    }

    public static boolean buyerSizeRequired(JewelryType type) {
        return type != null && type.requiresHandSize();
    }
}
