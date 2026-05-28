package com.jewelry.system.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.jewelry.system.dto.order.FileInfoDto;
import com.jewelry.system.dto.order.OrderDesignBlockDto;
import com.jewelry.system.dto.order.OrderInfoDto;
import com.jewelry.system.dto.order.OrderModelBlockDto;
import com.jewelry.system.dto.order.OrderQuotationBlockDto;
import com.jewelry.system.dto.order.OrderReviewBlockDto;
import com.jewelry.system.enums.OrderSource;
import com.jewelry.system.enums.OrderStatus;
import org.springframework.web.util.HtmlUtils;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * 将订单导出为紧凑表格版 HTML 生产工单（参考线下 MOJE 工单版式）。
 */
final class OrderHtmlWorksheetRenderer {

    private static final int STONE_TABLE_MIN_ROWS = 6;
    private static final int COLS = 12;

    private OrderHtmlWorksheetRenderer() {
    }

    static String render(OrderInfoDto o, List<FileInfoDto> files) {
        StringBuilder sb = new StringBuilder(8192);
        appendDocumentHead(sb, o);
        sb.append("<table class=\"sheet\" cellspacing=\"0\" cellpadding=\"0\">\n");

        appendTitleRow(sb);
        appendHeaderBlock(sb, o);
        appendDesignBlock(sb, o);
        appendStoneTable(sb, o.getDesignInfo());
        appendProcessRequirementRow(sb, o.getDesignInfo());
        appendPricingBlock(sb, o);
        appendReviewBlock(sb, o.getReviewInfo());
        appendModelSupplementBlock(sb, o.getModelInfo());
        appendWecomBlock(sb, o);
        appendAttachmentsBlock(sb, files);
        appendMetaBlock(sb, o);

        sb.append("</table>\n</body>\n</html>\n");
        return sb.toString();
    }

    private static void appendDocumentHead(StringBuilder sb, OrderInfoDto o) {
        String title = "生产订单";
        if (o.getBaseInfo() != null && o.getBaseInfo().getOrderNumber() != null && !o.getBaseInfo().getOrderNumber().isBlank()) {
            title = o.getBaseInfo().getOrderNumber();
        }
        sb.append("<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n");
        sb.append("<meta charset=\"UTF-8\">\n");
        sb.append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n");
        sb.append("<title>").append(e(title)).append("</title>\n");
        sb.append("<style>\n");
        sb.append("*{box-sizing:border-box;}\n");
        sb.append("body{margin:12px;font-family:\"Noto Sans SC\",\"Microsoft YaHei\",\"PingFang SC\",SimSun,system-ui,sans-serif;");
        sb.append("font-size:12px;line-height:1.35;color:#000;background:#fff;}\n");
        sb.append("table.sheet{width:100%;max-width:210mm;border-collapse:collapse;table-layout:fixed;}\n");
        sb.append("table.sheet td,table.sheet th{border:1px solid #000;padding:3px 5px;vertical-align:middle;word-break:break-word;}\n");
        sb.append(".th{background:#f0f0f0;font-weight:700;text-align:center;white-space:nowrap;}\n");
        sb.append(".lbl{font-weight:700;background:#fafafa;white-space:nowrap;}\n");
        sb.append(".center{text-align:center;}\n");
        sb.append(".title{font-size:18px;font-weight:700;letter-spacing:2px;padding:8px 4px !important;}\n");
        sb.append(".notes{min-height:2.4em;white-space:pre-wrap;}\n");
        sb.append(".img-cell{text-align:center;vertical-align:middle;padding:6px !important;}\n");
        sb.append(".img-cell img{max-width:100%;max-height:220px;height:auto;display:block;margin:0 auto;}\n");
        sb.append(".img-grid{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;}\n");
        sb.append(".img-grid figure{margin:0;max-width:46%;}\n");
        sb.append(".img-grid img{max-width:100%;max-height:150px;border:1px solid #ccc;}\n");
        sb.append(".img-grid figcaption{font-size:10px;color:#444;margin-top:2px;}\n");
        sb.append(".chk{width:14px;text-align:center;font-family:monospace;}\n");
        sb.append(".total-cell{text-align:right;font-size:16px;font-weight:700;padding:8px 12px !important;}\n");
        sb.append(".section-hdr{font-weight:700;text-align:center;background:#e8e8e8;}\n");
        sb.append(".muted{color:#555;font-size:11px;}\n");
        sb.append("@media print{body{margin:0;} table.sheet{max-width:100%;}}\n");
        sb.append("</style>\n</head>\n<body>\n");
    }

    private static void appendTitleRow(StringBuilder sb) {
        sb.append("<tr><td colspan=\"").append(COLS).append("\" class=\"center title\">MOJE 生产订单</td></tr>\n");
    }

    private static void appendHeaderBlock(StringBuilder sb, OrderInfoDto o) {
        OrderInfoDto.OrderBaseDto b = o.getBaseInfo();
        String orderNo = b != null ? nv(b.getOrderNumber()) : "";
        String orderTime = b != null ? formatDateTime(b.getOrderTime()) : "";
        String source = b != null ? sourceLabel(b.getSource()) : "";
        String customer = b != null ? nv(b.getCustomerName()) : "";
        String contact = b != null ? contactLine(b) : "";
        String style = b != null ? nv(b.getStyle()) : "";
        String deposit = b != null && b.getDepositAmount() != null ? formatMoney(b.getDepositAmount()) : "";
        String material = materialLine(b, o.getDesignInfo());
        String handSize = o.getDesignInfo() != null ? nv(o.getDesignInfo().getHandSize()) : "";
        String engraving = o.getDesignInfo() != null ? nv(o.getDesignInfo().getEngravingText()) : "";
        String status = statusLabel(o.getCurrentStatus());
        String sales = nv(o.getAssignedSalesName());
        String designer = o.getDesignInfo() != null ? nv(o.getDesignInfo().getDesignerName()) : "";
        String modeler = o.getModelInfo() != null ? nv(o.getModelInfo().getModelerName()) : "";
        String tracker = o.getReviewInfo() != null ? nv(o.getReviewInfo().getTrackerName()) : "";
        String sourceDetail = b != null ? nv(b.getSourceDetail()) : "";
        String wechat = b != null ? nv(b.getCustomerWechat()) : "";
        String requirements = b != null ? nv(b.getBasicRequirements()) : "";

        kvRow(sb, "订单编号", orderNo, "来单日期", orderTime, "当前状态", status);
        kvRow(sb, "客户类型", source, "客户", customer, "联系方式", contact);
        kvRow(sb, "品名/款式", style, "定金", deposit, "来源详情", sourceDetail);
        kvRow(sb, "材质", material, "手寸/规格", handSize, "字印", engraving);
        kvRow(sb, "指派销售", sales, "设计师", designer, "建模师", modeler);
        sb.append("<tr>");
        labelCell(sb, "跟单员", 2);
        valueCell(sb, tracker, 2);
        labelCell(sb, "客户微信", 2);
        valueCell(sb, wechat, 2);
        labelCell(sb, "设计审核", 2);
        valueCell(sb, designPassedLabel(o.getDesignInfo()), 2);
        sb.append("</tr>\n");
        sb.append("<tr><td colspan=\"2\" class=\"lbl\">基础需求</td><td colspan=\"")
                .append(COLS - 2).append("\" class=\"val notes\">").append(e(requirements)).append("</td></tr>\n");
    }

    private static void appendDesignBlock(StringBuilder sb, OrderInfoDto o) {
        OrderDesignBlockDto d = o.getDesignInfo();
        String designNotes = d != null ? nv(d.getDesignNotes()) : "";
        boolean cert = hasCertificate(o.getQuotationInfo());
        boolean confidential = o.getQuotationInfo() != null && Boolean.TRUE.equals(o.getQuotationInfo().getConfidential());
        boolean designBuyout = o.getQuotationInfo() != null && Boolean.TRUE.equals(o.getQuotationInfo().getDesignBuyout());

        List<String> imageUrls = new ArrayList<>();
        if (d != null && d.getDesignImages() != null) {
            imageUrls.addAll(d.getDesignImages());
        }
        if (o.getModelInfo() != null && o.getModelInfo().getModelEffectImages() != null) {
            imageUrls.addAll(o.getModelInfo().getModelEffectImages());
        }

        int imgRowSpan = 3;
        sb.append("<tr>");
        labelCell(sb, "看设计图", 2);
        sb.append("<td rowspan=\"").append(imgRowSpan).append("\" colspan=\"4\" class=\"val notes\">")
                .append(e(designNotes.isEmpty() ? "（无设计备注）" : designNotes));
        if (d != null && d.getMaterialDetail() != null && !d.getMaterialDetail().isBlank()) {
            sb.append("<br><span class=\"muted\">材质详情：").append(e(d.getMaterialDetail())).append("</span>");
        }
        sb.append("</td>");
        sb.append("<td rowspan=\"").append(imgRowSpan).append("\" colspan=\"6\" class=\"img-cell\">");
        appendImageGrid(sb, imageUrls, "设计图");
        sb.append("</td></tr>\n");

        sb.append("<tr>");
        checkboxCell(sb, "鉴定证书", cert);
        checkboxCell(sb, "保密不宣传", confidential);
        checkboxCell(sb, "设计买断", designBuyout);
        sb.append("<td colspan=\"6\" class=\"muted val\">").append(e(modelPassedLine(o.getModelInfo()))).append("</td></tr>\n");

        if (d != null && d.getDesignPassedTime() != null && !d.getDesignPassedTime().isBlank()) {
            sb.append("<tr><td colspan=\"6\" class=\"muted val\">设计通过：")
                    .append(e(formatDateTime(d.getDesignPassedTime()))).append("</td><td colspan=\"6\"></td></tr>\n");
        }
    }

    private static void appendStoneTable(StringBuilder sb, OrderDesignBlockDto d) {
        sectionHeader(sb, "石料明细");
        sb.append("<tr class=\"th\">");
        for (String h : new String[]{"石料类型", "形状", "尺寸", "数量", "价格", "备注"}) {
            sb.append("<th colspan=\"2\">").append(h).append("</th>");
        }
        sb.append("</tr>\n");

        List<StoneRow> rows = parseStoneRows(d != null ? d.getStoneInfo() : null);
        for (StoneRow row : rows) {
            sb.append("<tr>");
            stoneCell(sb, row.stoneType);
            stoneCell(sb, row.shape);
            stoneCell(sb, row.size);
            stoneCell(sb, row.quantity);
            stoneCell(sb, row.price);
            stoneCell(sb, row.notes);
            sb.append("</tr>\n");
        }
        int empty = Math.max(0, STONE_TABLE_MIN_ROWS - rows.size());
        for (int i = 0; i < empty; i++) {
            sb.append("<tr>");
            for (int c = 0; c < 6; c++) {
                stoneCell(sb, "");
            }
            sb.append("</tr>\n");
        }
    }

    private static void stoneCell(StringBuilder sb, String text) {
        sb.append("<td colspan=\"2\" class=\"center\">").append(text.isEmpty() ? "&nbsp;" : e(text)).append("</td>");
    }

    private static void appendProcessRequirementRow(StringBuilder sb, OrderDesignBlockDto d) {
        Set<String> selected = collectProcessNames(d != null ? d.getProcessInfo() : null);
        sectionHeader(sb, "工艺要求");
        sb.append("<tr>");
        processCheckbox(sb, "拉丝", selected);
        processCheckbox(sb, "喷砂", selected);
        processCheckbox(sb, "钉砂", selected);
        processCheckbox(sb, "珐琅", selected);
        sb.append("<td colspan=\"2\" class=\"lbl center\">其他</td>");
        sb.append("<td colspan=\"2\" class=\"val\">").append(e(otherProcessesText(selected))).append("</td>");
        sb.append("</tr>\n");
        String detail = d != null ? processDetailNotes(d.getProcessInfo()) : "";
        if (!detail.isBlank()) {
            sb.append("<tr><td colspan=\"2\" class=\"lbl\">工艺备注</td><td colspan=\"")
                    .append(COLS - 2).append("\" class=\"val notes\">").append(e(detail)).append("</td></tr>\n");
        }
    }

    private static void appendPricingBlock(StringBuilder sb, OrderInfoDto o) {
        OrderQuotationBlockDto q = o.getQuotationInfo();
        OrderModelBlockDto m = o.getModelInfo();
        sectionHeader(sb, "价格");
        sb.append("<tr>");
        pricePair(sb, "建模师", m != null ? nv(m.getModelerName()) : "");
        pricePair(sb, "克重(g)", m != null && m.getWeight() != null ? String.format(Locale.ROOT, "%.3f", m.getWeight()) : "");
        pricePair(sb, "工费", q != null ? formatMoney(q.getLaborCost()) : "");
        pricePair(sb, "工艺费", q != null ? formatMoney(q.getProcessCost()) : "");
        pricePair(sb, "石料费", q != null ? formatMoney(q.getStoneCost()) : "");
        pricePair(sb, "材质费", q != null ? formatMoney(q.getMaterialCost()) : "");
        sb.append("</tr>\n");
        sb.append("<tr>");
        pricePair(sb, "克重费", q != null ? formatMoney(q.getWeightCost()) : "");
        pricePair(sb, "证书费", q != null ? formatMoney(q.getCertificateCost()) : "");
        pricePair(sb, "买断费", q != null ? formatMoney(q.getDesignBuyoutCost()) : "");
        pricePair(sb, "其他费", q != null ? formatMoney(q.getOtherCost()) : "");
        pricePair(sb, "设计买断", q != null && Boolean.TRUE.equals(q.getDesignBuyout()) ? "是" : "否");
        pricePair(sb, "证书类型", certificateTypesLine(q));
        sb.append("</tr>\n");
        sb.append("<tr><td colspan=\"10\"></td><td colspan=\"2\" class=\"total-cell\">合计：")
                .append(e(q != null ? formatMoney(q.getTotalCost()) : "")).append("</td></tr>\n");
        if (q != null && q.getQuotationNotes() != null && !q.getQuotationNotes().isBlank()) {
            sb.append("<tr><td colspan=\"2\" class=\"lbl\">报价备注</td><td colspan=\"")
                    .append(COLS - 2).append("\" class=\"val notes\">").append(e(q.getQuotationNotes())).append("</td></tr>\n");
        }
    }

    private static void pricePair(StringBuilder sb, String label, String value) {
        sb.append("<td colspan=\"1\" class=\"lbl center\">").append(e(label)).append("</td>");
        sb.append("<td colspan=\"1\" class=\"val center\">").append(e(nv(value))).append("</td>");
    }

    private static void appendReviewBlock(StringBuilder sb, OrderReviewBlockDto r) {
        if (r == null) {
            return;
        }
        sectionHeader(sb, "工艺评审");
        kvRow(sb, "跟单员", nv(r.getTrackerName()),
                "评审结果", Boolean.TRUE.equals(r.getReviewPassed()) ? "通过" : "未通过",
                "评审时间", formatDateTime(r.getReviewPassedTime()));
        String rejected = r.getRejectedProcesses() != null && !r.getRejectedProcesses().isEmpty()
                ? String.join("、", r.getRejectedProcesses()) : "";
        sb.append("<tr><td colspan=\"2\" class=\"lbl\">驳回原因</td><td colspan=\"4\" class=\"val\">")
                .append(e(nv(r.getRejectionReason()))).append("</td>");
        sb.append("<td colspan=\"2\" class=\"lbl\">驳回工艺</td><td colspan=\"4\" class=\"val\">")
                .append(e(rejected)).append("</td></tr>\n");
        if (r.getReviewNotes() != null && !r.getReviewNotes().isBlank()) {
            sb.append("<tr><td colspan=\"2\" class=\"lbl\">评审备注</td><td colspan=\"")
                    .append(COLS - 2).append("\" class=\"val notes\">").append(e(r.getReviewNotes())).append("</td></tr>\n");
        }
    }

    private static void appendModelSupplementBlock(StringBuilder sb, OrderModelBlockDto m) {
        if (m == null) {
            return;
        }
        boolean hasExtra = (m.getModelNotes() != null && !m.getModelNotes().isBlank())
                || (m.getLastRejectToDesignerMessage() != null && !m.getLastRejectToDesignerMessage().isBlank())
                || m.getModelFiles() != null;
        if (!hasExtra) {
            return;
        }
        sectionHeader(sb, "建模补充");
        kvRow(sb, "建模审核", modelPassedLabel(m),
                "通过时间", formatDateTime(m.getModelPassedTime()),
                "克重备注", truncate(nv(m.getModelNotes()), 36));
        if (m.getLastRejectToDesignerMessage() != null && !m.getLastRejectToDesignerMessage().isBlank()) {
            sb.append("<tr><td colspan=\"2\" class=\"lbl\">驳回设计师</td><td colspan=\"")
                    .append(COLS - 2).append("\" class=\"val notes\">").append(e(m.getLastRejectToDesignerMessage())).append("</td></tr>\n");
        }
        if (m.getModelFiles() != null) {
            sb.append("<tr><td colspan=\"2\" class=\"lbl\">建模文件</td><td colspan=\"")
                    .append(COLS - 2).append("\" class=\"val notes\"><pre style=\"margin:0;font:inherit;white-space:pre-wrap;\">")
                    .append(e(jsonText(m.getModelFiles()))).append("</pre></td></tr>\n");
        }
    }

    private static void appendWecomBlock(StringBuilder sb, OrderInfoDto o) {
        if ((o.getWecomJoinQrBase64() == null || o.getWecomJoinQrBase64().isBlank())
                && (o.getWecomJoinError() == null || o.getWecomJoinError().isBlank())) {
            return;
        }
        sectionHeader(sb, "企业微信客户群");
        if (o.getWecomJoinError() != null && !o.getWecomJoinError().isBlank()) {
            sb.append("<tr><td colspan=\"").append(COLS).append("\" class=\"val muted\">")
                    .append(e(o.getWecomJoinError())).append("</td></tr>\n");
        }
        if (o.getWecomJoinQrBase64() != null && !o.getWecomJoinQrBase64().isBlank()) {
            sb.append("<tr><td colspan=\"").append(COLS).append("\" class=\"img-cell\"><img src=\"data:image/jpeg;base64,")
                    .append(o.getWecomJoinQrBase64()).append("\" alt=\"企微进群二维码\"/></td></tr>\n");
        }
    }

    private static void appendAttachmentsBlock(StringBuilder sb, List<FileInfoDto> files) {
        if (files == null || files.isEmpty()) {
            return;
        }
        sectionHeader(sb, "订单附件");
        sb.append("<tr class=\"th\"><th colspan=\"3\">文件名</th><th colspan=\"2\">类型</th><th colspan=\"2\">上传</th><th colspan=\"5\">预览</th></tr>\n");
        for (FileInfoDto f : files) {
            if (f == null) {
                continue;
            }
            String name = f.getFileName() != null ? f.getFileName() : "附件";
            String href = firstNonBlank(f.getFileUrl(), f.getFilePath());
            sb.append("<tr><td colspan=\"3\">").append(e(name)).append("</td>");
            sb.append("<td colspan=\"2\">").append(e(nv(f.getFileType()))).append("</td>");
            sb.append("<td colspan=\"2\">").append(e(nv(f.getUploadTime()))).append("</td>");
            sb.append("<td colspan=\"5\" class=\"img-cell\">");
            if (href != null && !href.isBlank() && isLikelyImage(name, href)) {
                String src = safeImgSrc(href);
                if (src != null) {
                    sb.append("<img src=\"").append(src).append("\" alt=\"").append(e(name)).append("\"/> ");
                }
                if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) {
                    sb.append("<a href=\"").append(e(href)).append("\" target=\"_blank\" rel=\"noopener\">链接</a>");
                }
            } else if (href != null && !href.isBlank()
                    && (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//"))) {
                sb.append("<a href=\"").append(e(href)).append("\" target=\"_blank\" rel=\"noopener\">")
                        .append(e(name)).append("</a>");
            } else {
                sb.append(e(name)).append(" <span class=\"muted\">（无外链）</span>");
            }
            sb.append("</td></tr>\n");
        }
    }

    private static void appendMetaBlock(StringBuilder sb, OrderInfoDto o) {
        sectionHeader(sb, "系统记录");
        kvRow(sb, "创建时间", formatDateTime(o.getCreatedAt()),
                "更新时间", formatDateTime(o.getUpdatedAt()),
                "订单ID", o.getBaseInfo() != null && o.getBaseInfo().getId() != null ? String.valueOf(o.getBaseInfo().getId()) : "");
    }

    private static void sectionHeader(StringBuilder sb, String title) {
        sb.append("<tr><td colspan=\"").append(COLS).append("\" class=\"section-hdr\">").append(e(title)).append("</td></tr>\n");
    }

    private static void kvRow(StringBuilder sb, String l1, String v1, String l2, String v2, String l3, String v3) {
        sb.append("<tr>");
        labelCell(sb, l1, 2);
        valueCell(sb, v1, 2);
        labelCell(sb, l2, 2);
        valueCell(sb, v2, 2);
        labelCell(sb, l3, 2);
        valueCell(sb, v3, 2);
        sb.append("</tr>\n");
    }

    private static void labelCell(StringBuilder sb, String label, int colspan) {
        sb.append("<td colspan=\"").append(colspan).append("\" class=\"lbl\">").append(e(label)).append("</td>");
    }

    private static void valueCell(StringBuilder sb, String value, int colspan) {
        sb.append("<td colspan=\"").append(colspan).append("\" class=\"val\">").append(e(nv(value))).append("</td>");
    }

    private static void checkboxCell(StringBuilder sb, String label, boolean checked) {
        sb.append("<td class=\"chk\">").append(checked ? "☑" : "☐").append("</td>");
        sb.append("<td class=\"lbl\">").append(e(label)).append("</td>");
    }

    private static void processCheckbox(StringBuilder sb, String name, Set<String> selected) {
        sb.append("<td class=\"chk\">").append(selected.contains(name) ? "☑" : "☐").append("</td>");
        sb.append("<td class=\"lbl\">").append(e(name)).append("</td>");
    }

    private static void appendImageGrid(StringBuilder sb, List<String> urls, String altPrefix) {
        if (urls == null || urls.isEmpty()) {
            sb.append("<span class=\"muted\">（暂无设计图/效果图）</span>");
            return;
        }
        sb.append("<div class=\"img-grid\">");
        int shown = 0;
        for (String raw : urls) {
            if (raw == null || raw.isBlank()) {
                continue;
            }
            String src = safeImgSrc(raw.trim());
            if (src == null) {
                continue;
            }
            shown++;
            sb.append("<figure><img src=\"").append(src).append("\" alt=\"").append(e(altPrefix)).append(shown).append("\"/>");
            sb.append("<figcaption>").append(e(shortenUrlCaption(raw.trim()))).append("</figcaption></figure>");
        }
        sb.append("</div>");
        if (shown == 0) {
            sb.append("<span class=\"muted\">（图片地址无法嵌入，请在系统中查看）</span>");
        }
    }

    private static final Set<String> STANDARD_PROCESS_LABELS = Set.of("拉丝", "喷砂", "钉砂", "珐琅");

    private static class StoneRow {
        String stoneType = "";
        String shape = "";
        String size = "";
        String quantity = "";
        String price = "";
        String notes = "";
    }

    private static List<StoneRow> parseStoneRows(Object stoneInfo) {
        List<StoneRow> rows = new ArrayList<>();
        JsonNode arr = toArrayNode(stoneInfo);
        if (arr == null) {
            return rows;
        }
        for (JsonNode node : arr) {
            if (node == null || !node.isObject()) {
                continue;
            }
            StoneRow row = new StoneRow();
            row.stoneType = stoneTypeLabel(text(node.get("stoneType")));
            row.shape = stoneShapeLabel(text(node.get("shape")));
            row.size = nv(text(node.get("size")));
            JsonNode qty = node.get("quantity");
            row.quantity = qty != null && qty.isNumber() ? String.valueOf(qty.asInt()) : nv(text(qty));
            JsonNode price = node.get("price");
            if (price != null && price.isNumber()) {
                row.price = formatMoney(price.asDouble());
            } else {
                row.price = nv(text(price));
            }
            row.notes = nv(text(node.get("notes")));
            rows.add(row);
        }
        return rows;
    }

    private static Set<String> collectProcessNames(Object processInfo) {
        Set<String> names = new LinkedHashSet<>();
        JsonNode arr = toArrayNode(processInfo);
        if (arr == null) {
            return names;
        }
        for (JsonNode node : arr) {
            if (node == null || !node.isObject()) {
                continue;
            }
            String custom = text(node.get("customProcess"));
            if (!custom.isBlank()) {
                names.add(custom.trim());
                continue;
            }
            String label = processTypeLabel(text(node.get("processType")));
            if (!label.isBlank()) {
                names.add(label);
            }
        }
        return names;
    }

    private static String otherProcessesText(Set<String> selected) {
        if (selected == null || selected.isEmpty()) {
            return "";
        }
        List<String> other = new ArrayList<>();
        for (String name : selected) {
            if (!STANDARD_PROCESS_LABELS.contains(name)) {
                other.add(name);
            }
        }
        return String.join("、", other);
    }

    private static String processDetailNotes(Object processInfo) {
        JsonNode arr = toArrayNode(processInfo);
        if (arr == null) {
            return "";
        }
        StringBuilder notes = new StringBuilder();
        for (JsonNode node : arr) {
            if (node == null || !node.isObject()) {
                continue;
            }
            String line = text(node.get("notes"));
            if (line.isBlank()) {
                continue;
            }
            String name = processLineName(node);
            if (!notes.isEmpty()) {
                notes.append('\n');
            }
            if (!name.isBlank()) {
                notes.append(name).append("：").append(line.trim());
            } else {
                notes.append(line.trim());
            }
        }
        return notes.toString();
    }

    private static String processLineName(JsonNode node) {
        String custom = text(node.get("customProcess"));
        if (!custom.isBlank()) {
            return custom.trim();
        }
        return processTypeLabel(text(node.get("processType")));
    }

    private static JsonNode toArrayNode(Object info) {
        if (info instanceof JsonNode node) {
            return node.isArray() ? node : null;
        }
        return null;
    }

    private static String text(Object value) {
        if (value == null) {
            return "";
        }
        if (value instanceof JsonNode node) {
            if (node.isNull() || node.isMissingNode()) {
                return "";
            }
            if (node.isTextual()) {
                return node.asText();
            }
            if (node.isNumber() || node.isBoolean()) {
                return node.asText();
            }
            return node.toString();
        }
        return String.valueOf(value);
    }

    private static String jsonText(Object node) {
        if (node == null) {
            return "";
        }
        if (node instanceof JsonNode jn) {
            return jn.toPrettyString();
        }
        return String.valueOf(node);
    }

    private static String materialLine(OrderInfoDto.OrderBaseDto b, OrderDesignBlockDto d) {
        String fromDesign = d != null ? materialTypeLabel(d.getMaterialType()) : "";
        String fromBase = b != null ? nv(b.getMaterialInfo()) : "";
        if (!fromDesign.isBlank() && !fromBase.isBlank()) {
            return fromDesign + " / " + fromBase;
        }
        return firstNonBlank(fromDesign, fromBase);
    }

    private static String contactLine(OrderInfoDto.OrderBaseDto b) {
        if (b == null) {
            return "";
        }
        return firstNonBlank(b.getCustomerContact(), b.getCustomerWechat());
    }

    private static String designPassedLabel(OrderDesignBlockDto d) {
        if (d == null || d.getDesignPassed() == null) {
            return "";
        }
        return Boolean.TRUE.equals(d.getDesignPassed()) ? "已通过" : "未通过";
    }

    private static String modelPassedLabel(OrderModelBlockDto m) {
        if (m == null || m.getModelPassed() == null) {
            return "";
        }
        return Boolean.TRUE.equals(m.getModelPassed()) ? "已通过" : "未通过";
    }

    private static String modelPassedLine(OrderModelBlockDto m) {
        if (m == null) {
            return "";
        }
        StringBuilder line = new StringBuilder();
        String audit = modelPassedLabel(m);
        if (!audit.isBlank()) {
            line.append("建模审核：").append(audit);
        }
        if (m.getWeight() != null) {
            if (!line.isEmpty()) {
                line.append("；");
            }
            line.append("克重 ").append(String.format(Locale.ROOT, "%.3f", m.getWeight())).append("g");
        }
        if (m.getModelPassedTime() != null && !m.getModelPassedTime().isBlank()) {
            if (!line.isEmpty()) {
                line.append("；");
            }
            line.append("通过时间 ").append(formatDateTime(m.getModelPassedTime()));
        }
        return line.toString();
    }

    private static boolean hasCertificate(OrderQuotationBlockDto q) {
        if (q == null) {
            return false;
        }
        if (q.getCertificateCost() != null && q.getCertificateCost() > 0) {
            return true;
        }
        return q.getCertificateTypes() != null && !q.getCertificateTypes().isEmpty();
    }

    private static String certificateTypesLine(OrderQuotationBlockDto q) {
        if (q == null || q.getCertificateTypes() == null || q.getCertificateTypes().isEmpty()) {
            return "";
        }
        List<String> labels = new ArrayList<>();
        for (String type : q.getCertificateTypes()) {
            labels.add(certificateTypeLabel(type));
        }
        return String.join("、", labels);
    }

    private static String safeImgSrc(String url) {
        String u = url.trim();
        if (u.startsWith("data:image/") && u.contains(";base64,") && isAllowedDataImagePrefix(u)) {
            return HtmlUtils.htmlEscape(u, "UTF-8");
        }
        if (u.startsWith("https://") || u.startsWith("http://") || u.startsWith("//")) {
            return HtmlUtils.htmlEscape(u, "UTF-8");
        }
        return null;
    }

    private static boolean isAllowedDataImagePrefix(String u) {
        String head = u.length() > 64 ? u.substring(0, 64) : u;
        head = head.toLowerCase(Locale.ROOT);
        return head.startsWith("data:image/jpeg;base64,")
                || head.startsWith("data:image/jpg;base64,")
                || head.startsWith("data:image/png;base64,")
                || head.startsWith("data:image/gif;base64,")
                || head.startsWith("data:image/webp;base64,")
                || head.startsWith("data:image/bmp;base64,")
                || head.startsWith("data:image/x-ms-bmp;base64,");
    }

    private static boolean isLikelyImage(String fileName, String url) {
        String probe = ((fileName != null ? fileName : "") + " " + (url != null ? url : "")).toLowerCase(Locale.ROOT);
        return probe.contains(".jpg") || probe.contains(".jpeg") || probe.contains(".png") || probe.contains(".gif")
                || probe.contains(".webp") || probe.contains(".bmp") || probe.contains(".svg")
                || probe.contains(".heic") || probe.contains(".avif");
    }

    private static String shortenUrlCaption(String url) {
        if (url.length() <= 96) {
            return url;
        }
        return url.substring(0, 40) + "…" + url.substring(url.length() - 40);
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }

    private static String nv(String s) {
        return s == null ? "" : s;
    }

    private static String truncate(String s, int max) {
        if (s == null || s.isEmpty()) {
            return "";
        }
        if (s.length() <= max) {
            return s;
        }
        return s.substring(0, max) + "…";
    }

    private static String formatMoney(Double amount) {
        if (amount == null) {
            return "";
        }
        return String.format(Locale.ROOT, "%.2f", amount);
    }

    private static String formatDateTime(String iso) {
        if (iso == null || iso.isBlank()) {
            return "";
        }
        String s = iso.trim();
        if (s.length() >= 16 && s.charAt(10) == 'T') {
            return s.substring(0, 16).replace('T', ' ');
        }
        if (s.length() >= 16) {
            return s.substring(0, 16);
        }
        return s;
    }

    private static String e(String s) {
        return HtmlUtils.htmlEscape(s == null ? "" : s, "UTF-8");
    }

    private static String sourceLabel(String source) {
        if (source == null || source.isBlank()) {
            return "";
        }
        String key = source.trim().toUpperCase(Locale.ROOT);
        if ("RECOMMEND".equals(key)) {
            return "达人推荐";
        }
        if ("OTHER".equals(key)) {
            return "其他";
        }
        try {
            OrderSource src = OrderSource.valueOf(key);
            return src.getDescription();
        } catch (IllegalArgumentException ignored) {
            return source;
        }
    }

    private static String statusLabel(String status) {
        if (status == null || status.isBlank()) {
            return "";
        }
        try {
            return OrderStatus.fromString(status).getDescription();
        } catch (IllegalArgumentException ignored) {
            return status;
        }
    }

    private static String materialTypeLabel(String materialType) {
        if (materialType == null || materialType.isBlank()) {
            return "";
        }
        return switch (materialType.trim().toUpperCase(Locale.ROOT)) {
            case "SILVER_925" -> "925银";
            case "PURE_SILVER" -> "足银";
            case "PURE_GOLD" -> "足金";
            case "K_GOLD" -> "K金";
            case "OTHER" -> "其他";
            default -> materialType;
        };
    }

    private static String processTypeLabel(String processType) {
        if (processType == null || processType.isBlank()) {
            return "";
        }
        return switch (processType.trim().toUpperCase(Locale.ROOT)) {
            case "ENAMEL" -> "珐琅";
            case "WIRE_DRAWING" -> "拉丝";
            case "SAND_BLASTING" -> "喷砂";
            case "NAIL_SAND" -> "钉砂";
            case "OTHER" -> "其他";
            default -> processType;
        };
    }

    private static String stoneTypeLabel(String stoneType) {
        if (stoneType == null || stoneType.isBlank()) {
            return "";
        }
        return switch (stoneType.trim().toUpperCase(Locale.ROOT)) {
            case "DIAMOND" -> "钻石";
            case "RUBY" -> "红宝石";
            case "SAPPHIRE" -> "蓝宝石";
            case "EMERALD" -> "翡翠";
            case "JADE" -> "玉石";
            case "PEARL" -> "珍珠";
            case "CRYSTAL" -> "水晶";
            case "OTHER" -> "其他";
            default -> stoneType;
        };
    }

    private static String stoneShapeLabel(String shape) {
        if (shape == null || shape.isBlank()) {
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
            case "EMERALD_CUT" -> "祖母绿形";
            case "ASSCHER" -> "阿斯切形";
            case "BAGUETTE" -> "长阶梯形";
            case "OTHER" -> "其他";
            default -> shape;
        };
    }

    private static String certificateTypeLabel(String certificateType) {
        if (certificateType == null || certificateType.isBlank()) {
            return "";
        }
        return switch (certificateType.trim().toUpperCase(Locale.ROOT)) {
            case "COPYRIGHT" -> "版权证书";
            case "APPRAISAL" -> "鉴定证书";
            case "QUALITY" -> "质量证书";
            case "OTHER" -> "其他";
            default -> certificateType;
        };
    }
}
