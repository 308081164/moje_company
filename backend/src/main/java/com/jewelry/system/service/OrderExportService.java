package com.jewelry.system.service;

import com.jewelry.system.dto.order.FileInfoDto;
import com.jewelry.system.dto.order.OrderInfoDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderExportService {

    private final OrderQueryService orderQueryService;
    private final OrderFileService orderFileService;

    @Transactional(readOnly = true)
    public byte[] exportOrderMarkdown(long orderId) {
        OrderInfoDto dto = orderQueryService.getOrder(orderId);
        String md = renderMarkdown(dto);
        return md.getBytes(StandardCharsets.UTF_8);
    }

    @Transactional(readOnly = true)
    public byte[] exportOrderHtml(long orderId) {
        OrderInfoDto dto = orderQueryService.getOrder(orderId);
        List<FileInfoDto> files = orderFileService.listForOrder(orderId);
        String html = OrderHtmlWorksheetRenderer.render(dto, files);
        return html.getBytes(StandardCharsets.UTF_8);
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
