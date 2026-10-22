package com.jewelry.system.dto.portal;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class PortalCustomerOrderCreateRequest {
    /** CUSTOM_IMAGE / DESIGNER_DESIGN */
    private String serviceType;
    private String customerName;
    private String basicRequirements;
    private String styleInfo;
    private String materialInfo;
    /**
     * 已忽略。实收定金由服务端按服务单价 × 件数计算，不采用客户端传入金额。
     */
    private BigDecimal depositAmount;
    /** 参考图（URL 或 base64 data URI 列表，来图定制必传） */
    private List<String> referenceImages;
    /** 个人推广码（选填）：订单完成后推广人获得订单金额 5% 佣金 */
    private String referralCode;
    /**
     * 本单计划生产的珠宝单件数量（1–5），用于初始化 order_piece 与按件确认进度。
     * 未传时默认为 1。
     */
    private Integer pieceCount;
}
