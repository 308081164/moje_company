package com.jewelry.system.service;

import com.jewelry.system.dto.order.OrderInfoDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
public class OrderExportService {

    private final OrderQueryService orderQueryService;

    @Transactional(readOnly = true)
    public byte[] exportOrderMarkdown(long orderId) {
        OrderInfoDto dto = orderQueryService.getOrder(orderId);
        String md = renderMarkdown(dto);
        return md.getBytes(StandardCharsets.UTF_8);
    }

    @Transactional(readOnly = true)
    public byte[] exportOrderHtml(long orderId) {
        OrderInfoDto dto = orderQueryService.getOrder(orderId);
        String html = renderHtml(dto);
        return html.getBytes(StandardCharsets.UTF_8);
    }

    private static String renderHtml(OrderInfoDto o) {
        String title = "订单详情";
        if (o.getBaseInfo() != null && o.getBaseInfo().getOrderNumber() != null && !o.getBaseInfo().getOrderNumber().isBlank()) {
            title = e(o.getBaseInfo().getOrderNumber());
        }
        StringBuilder sb = new StringBuilder(4096);
        sb.append("<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n");
        sb.append("<meta charset=\"UTF-8\">\n");
        sb.append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n");
        sb.append("<title>").append(title).append("</title>\n");
        sb.append("<style>\n");
        sb.append("body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;");
        sb.append("line-height:1.5;max-width:900px;margin:24px auto;padding:0 16px;color:#222;}\n");
        sb.append("h1{font-size:1.5rem;border-bottom:1px solid #ddd;padding-bottom:8px;}\n");
        sb.append("h2{font-size:1.15rem;margin-top:1.5rem;color:#333;}\n");
        sb.append("dl{margin:0 0 1rem 0;}\n");
        sb.append("dt{font-weight:600;margin-top:0.5rem;color:#444;}\n");
        sb.append("dd{margin:0 0 0.25rem 0;}\n");
        sb.append("pre{background:#f6f8fa;border:1px solid #e1e4e8;border-radius:6px;padding:12px;");
        sb.append("white-space:pre-wrap;word-break:break-word;font-size:0.9rem;}\n");
        sb.append(".muted{color:#666;}\n");
        sb.append("</style>\n</head>\n<body>\n");
        sb.append("<h1>订单详情</h1>\n");

        if (o.getBaseInfo() != null) {
            sb.append("<h2>基本信息</h2>\n<dl>\n");
            rowHtml(sb, "订单编号", o.getBaseInfo().getOrderNumber());
            rowHtml(sb, "客户", o.getBaseInfo().getCustomerName());
            rowHtml(sb, "联系方式", o.getBaseInfo().getCustomerContact());
            rowHtml(sb, "来源", o.getBaseInfo().getSource());
            rowHtml(sb, "来源详情", o.getBaseInfo().getSourceDetail());
            rowHtml(sb, "定金", o.getBaseInfo().getDepositAmount() != null ? String.valueOf(o.getBaseInfo().getDepositAmount()) : "0");
            rowHtml(sb, "下单时间", o.getBaseInfo().getOrderTime());
            rowHtml(sb, "款式", o.getBaseInfo().getStyle());
            rowHtml(sb, "材质信息", o.getBaseInfo().getMaterialInfo());
            sb.append("</dl>\n");
            sb.append("<p><strong>基础需求</strong></p>\n").append(blockHtml(o.getBaseInfo().getBasicRequirements()));
        }

        sb.append("<h2>状态</h2>\n<dl>\n");
        rowHtml(sb, "当前状态", o.getCurrentStatus());
        rowHtml(sb, "创建时间", o.getCreatedAt());
        rowHtml(sb, "更新时间", o.getUpdatedAt());
        sb.append("</dl>\n");

        if (o.getDesignInfo() != null) {
            sb.append("<h2>设计信息</h2>\n<dl>\n");
            rowHtml(sb, "设计师", o.getDesignInfo().getDesignerName());
            rowHtml(sb, "字印", o.getDesignInfo().getEngravingText());
            rowHtml(sb, "材质类型", o.getDesignInfo().getMaterialType());
            rowHtml(sb, "手寸/链长", o.getDesignInfo().getHandSize());
            sb.append("</dl>\n");
            sb.append("<p><strong>设计备注</strong></p>\n").append(blockHtml(o.getDesignInfo().getDesignNotes()));
        }
        if (o.getModelInfo() != null) {
            sb.append("<h2>建模信息</h2>\n<dl>\n");
            rowHtml(sb, "建模师", o.getModelInfo().getModelerName());
            rowHtml(sb, "克重", o.getModelInfo().getWeight() != null ? String.valueOf(o.getModelInfo().getWeight()) : "");
            sb.append("</dl>\n");
            sb.append("<p><strong>建模备注</strong></p>\n").append(blockHtml(o.getModelInfo().getModelNotes()));
        }
        if (o.getReviewInfo() != null) {
            sb.append("<h2>工艺评审</h2>\n<dl>\n");
            rowHtml(sb, "跟单员", o.getReviewInfo().getTrackerName());
            rowHtml(sb, "是否通过", Boolean.TRUE.equals(o.getReviewInfo().getReviewPassed()) ? "通过" : "未通过");
            rowHtml(sb, "驳回原因", o.getReviewInfo().getRejectionReason());
            sb.append("</dl>\n");
            sb.append("<p><strong>评审备注</strong></p>\n").append(blockHtml(o.getReviewInfo().getReviewNotes()));
        }
        if (o.getQuotationInfo() != null) {
            sb.append("<h2>报价信息</h2>\n<dl>\n");
            rowHtml(sb, "工艺费", o.getQuotationInfo().getProcessCost());
            rowHtml(sb, "工费", o.getQuotationInfo().getLaborCost());
            rowHtml(sb, "证书费", o.getQuotationInfo().getCertificateCost());
            rowHtml(sb, "其他费用", o.getQuotationInfo().getOtherCost());
            rowHtml(sb, "总计", o.getQuotationInfo().getTotalCost());
            sb.append("</dl>\n");
            sb.append("<p><strong>报价备注</strong></p>\n").append(blockHtml(o.getQuotationInfo().getQuotationNotes()));
        }

        sb.append("</body>\n</html>\n");
        return sb.toString();
    }

    private static void rowHtml(StringBuilder sb, String label, Object value) {
        sb.append("<dt>").append(e(label)).append("</dt><dd>");
        sb.append(value == null ? "" : e(String.valueOf(value)));
        sb.append("</dd>\n");
    }

    private static String blockHtml(String s) {
        if (s == null || s.isBlank()) {
            return "<p class=\"muted\">无</p>\n";
        }
        return "<pre>" + e(s) + "</pre>\n";
    }

    private static String e(String s) {
        return HtmlUtils.htmlEscape(s, "UTF-8");
    }

    private static String renderMarkdown(OrderInfoDto o) {
        StringBuilder sb = new StringBuilder();
        sb.append("# 订单详情\n\n");
        if (o.getBaseInfo() != null) {
            sb.append("## 基本信息\n\n");
            sb.append("- 订单编号：").append(n(o.getBaseInfo().getOrderNumber())).append("\n");
            sb.append("- 客户：").append(n(o.getBaseInfo().getCustomerName())).append("\n");
            sb.append("- 联系方式：").append(n(o.getBaseInfo().getCustomerContact())).append("\n");
            sb.append("- 来源：").append(n(o.getBaseInfo().getSource())).append("\n");
            sb.append("- 来源详情：").append(n(o.getBaseInfo().getSourceDetail())).append("\n");
            sb.append("- 定金：").append(o.getBaseInfo().getDepositAmount() != null ? o.getBaseInfo().getDepositAmount() : 0).append("\n");
            sb.append("- 下单时间：").append(n(o.getBaseInfo().getOrderTime())).append("\n");
            sb.append("- 款式：").append(n(o.getBaseInfo().getStyle())).append("\n");
            sb.append("- 材质信息：").append(n(o.getBaseInfo().getMaterialInfo())).append("\n");
            sb.append("- 基础需求：\n\n").append(block(o.getBaseInfo().getBasicRequirements())).append("\n\n");
        }
        sb.append("## 状态\n\n");
        sb.append("- 当前状态：").append(n(o.getCurrentStatus())).append("\n");
        sb.append("- 创建时间：").append(n(o.getCreatedAt())).append("\n");
        sb.append("- 更新时间：").append(n(o.getUpdatedAt())).append("\n\n");

        if (o.getDesignInfo() != null) {
            sb.append("## 设计信息\n\n");
            sb.append("- 设计师：").append(n(o.getDesignInfo().getDesignerName())).append("\n");
            sb.append("- 字印：").append(n(o.getDesignInfo().getEngravingText())).append("\n");
            sb.append("- 材质类型：").append(n(o.getDesignInfo().getMaterialType())).append("\n");
            sb.append("- 手寸/链长：").append(n(o.getDesignInfo().getHandSize())).append("\n");
            sb.append("- 设计备注：\n\n").append(block(o.getDesignInfo().getDesignNotes())).append("\n\n");
        }
        if (o.getModelInfo() != null) {
            sb.append("## 建模信息\n\n");
            sb.append("- 建模师：").append(n(o.getModelInfo().getModelerName())).append("\n");
            sb.append("- 克重：").append(o.getModelInfo().getWeight() != null ? o.getModelInfo().getWeight() : "").append("\n");
            sb.append("- 建模备注：\n\n").append(block(o.getModelInfo().getModelNotes())).append("\n\n");
        }
        if (o.getReviewInfo() != null) {
            sb.append("## 工艺评审\n\n");
            sb.append("- 跟单员：").append(n(o.getReviewInfo().getTrackerName())).append("\n");
            sb.append("- 是否通过：").append(Boolean.TRUE.equals(o.getReviewInfo().getReviewPassed()) ? "通过" : "未通过").append("\n");
            sb.append("- 驳回原因：").append(n(o.getReviewInfo().getRejectionReason())).append("\n");
            sb.append("- 评审备注：\n\n").append(block(o.getReviewInfo().getReviewNotes())).append("\n\n");
        }
        if (o.getQuotationInfo() != null) {
            sb.append("## 报价信息\n\n");
            sb.append("- 工艺费：").append(n(o.getQuotationInfo().getProcessCost())).append("\n");
            sb.append("- 工费：").append(n(o.getQuotationInfo().getLaborCost())).append("\n");
            sb.append("- 证书费：").append(n(o.getQuotationInfo().getCertificateCost())).append("\n");
            sb.append("- 其他费用：").append(n(o.getQuotationInfo().getOtherCost())).append("\n");
            sb.append("- 总计：").append(n(o.getQuotationInfo().getTotalCost())).append("\n");
            sb.append("- 报价备注：\n\n").append(block(o.getQuotationInfo().getQuotationNotes())).append("\n\n");
        }
        return sb.toString();
    }

    private static String n(Object s) {
        return s == null ? "" : String.valueOf(s);
    }

    private static String block(String s) {
        if (s == null || s.isBlank()) {
            return "_无_";
        }
        return "```\n" + s + "\n```";
    }
}

