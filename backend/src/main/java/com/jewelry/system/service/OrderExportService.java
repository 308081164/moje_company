package com.jewelry.system.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.jewelry.system.dto.order.FileInfoDto;
import com.jewelry.system.dto.order.OrderInfoDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

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
        String html = renderHtml(dto, files);
        return html.getBytes(StandardCharsets.UTF_8);
    }

    private static String renderHtml(OrderInfoDto o, List<FileInfoDto> files) {
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
        sb.append(".figure-grid{display:flex;flex-wrap:wrap;gap:14px;margin:12px 0;align-items:flex-start;}\n");
        sb.append(".figure-grid figure{margin:0;max-width:min(100%,320px);border:1px solid #e1e4e8;border-radius:8px;");
        sb.append("padding:10px;background:#fafbfc;}\n");
        sb.append(".figure-grid img{max-width:100%;height:auto;display:block;border-radius:4px;}\n");
        sb.append(".figure-grid figcaption{font-size:0.82rem;color:#555;margin-top:8px;word-break:break-all;line-height:1.35;}\n");
        sb.append(".attach-list{list-style:none;padding:0;margin:0;}\n");
        sb.append(".attach-list li{margin:8px 0;padding:10px 12px;background:#f6f8fa;border:1px solid #e1e4e8;border-radius:8px;}\n");
        sb.append(".attach-list a{color:#0969da;text-decoration:none;word-break:break-all;}\n");
        sb.append(".attach-list a:hover{text-decoration:underline;}\n");
        sb.append("</style>\n</head>\n<body>\n");
        sb.append("<h1>订单详情</h1>\n");

        if (o.getBaseInfo() != null) {
            sb.append("<h2>基本信息</h2>\n<dl>\n");
            rowHtml(sb, "订单编号", o.getBaseInfo().getOrderNumber());
            rowHtml(sb, "指派销售", o.getAssignedSalesName());
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

        if (o.getWecomJoinQrBase64() != null && !o.getWecomJoinQrBase64().isBlank()) {
            sb.append("<h2>企业微信进群</h2>\n");
            if (o.getWecomJoinError() != null && !o.getWecomJoinError().isBlank()) {
                sb.append("<p class=\"muted\">").append(e(o.getWecomJoinError())).append("</p>\n");
            }
            sb.append("<figure style=\"max-width:280px;margin:0;\"><img src=\"data:image/jpeg;base64,")
                    .append(o.getWecomJoinQrBase64())
                    .append("\" alt=\"企微进群二维码\" style=\"max-width:100%;height:auto;border-radius:8px;border:1px solid #e1e4e8;\"/></figure>\n");
        } else if (o.getWecomJoinError() != null && !o.getWecomJoinError().isBlank()) {
            sb.append("<h2>企业微信进群</h2>\n<p class=\"muted\">").append(e(o.getWecomJoinError())).append("</p>\n");
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
            if (o.getDesignInfo().getProcessInfo() != null) {
                sb.append("<p><strong>工艺信息（JSON）</strong></p>\n").append(jsonBlockHtml(o.getDesignInfo().getProcessInfo()));
            }
            if (o.getDesignInfo().getStoneInfo() != null) {
                sb.append("<p><strong>石头信息（JSON）</strong></p>\n").append(jsonBlockHtml(o.getDesignInfo().getStoneInfo()));
            }
            appendImageGallery(sb, "设计参考图", o.getDesignInfo().getDesignImages());
        }
        if (o.getModelInfo() != null) {
            sb.append("<h2>建模信息</h2>\n<dl>\n");
            rowHtml(sb, "建模师", o.getModelInfo().getModelerName());
            rowHtml(sb, "克重", o.getModelInfo().getWeight() != null ? String.valueOf(o.getModelInfo().getWeight()) : "");
            sb.append("</dl>\n");
            sb.append("<p><strong>建模备注</strong></p>\n").append(blockHtml(o.getModelInfo().getModelNotes()));
            if (o.getModelInfo().getModelFiles() != null) {
                sb.append("<p><strong>建模文件（JSON）</strong></p>\n").append(jsonBlockHtml(o.getModelInfo().getModelFiles()));
            }
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

        appendOrderAttachmentsHtml(sb, files);

        sb.append("</body>\n</html>\n");
        return sb.toString();
    }

    private static void appendImageGallery(StringBuilder sb, String title, List<String> urls) {
        if (urls == null || urls.isEmpty()) {
            return;
        }
        sb.append("<h3>").append(e(title)).append("</h3>\n");
        StringBuilder grid = new StringBuilder();
        int shown = 0;
        for (String raw : urls) {
            if (raw == null || raw.isBlank()) {
                continue;
            }
            String trimmed = raw.trim();
            String src = safeImgSrc(trimmed);
            if (src == null) {
                continue;
            }
            shown++;
            grid.append("<figure><img src=\"").append(src).append("\" alt=\"设计图").append(shown).append("\" loading=\"lazy\"/>");
            grid.append("<figcaption>").append(e(shortenUrlCaption(trimmed))).append("</figcaption></figure>\n");
        }
        if (shown == 0) {
            sb.append("<p class=\"muted\">（所列地址无法在导出中作为安全图片嵌入，可在系统中查看原图）</p>\n");
            return;
        }
        sb.append("<div class=\"figure-grid\">\n").append(grid).append("</div>\n");
    }

    /** 仅允许 http(s)、//、受限的 data:image/* base64（排除 svg 等可执行载体） */
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
        head = head.toLowerCase();
        return head.startsWith("data:image/jpeg;base64,")
                || head.startsWith("data:image/jpg;base64,")
                || head.startsWith("data:image/png;base64,")
                || head.startsWith("data:image/gif;base64,")
                || head.startsWith("data:image/webp;base64,");
    }

    private static String shortenUrlCaption(String url) {
        if (url.length() <= 96) {
            return url;
        }
        return url.substring(0, 40) + "…" + url.substring(url.length() - 40);
    }

    private static void appendOrderAttachmentsHtml(StringBuilder sb, List<FileInfoDto> files) {
        if (files == null || files.isEmpty()) {
            return;
        }
        sb.append("<h2>订单附件</h2>\n<ul class=\"attach-list\">\n");
        for (FileInfoDto f : files) {
            if (f == null) {
                continue;
            }
            String name = f.getFileName() != null ? f.getFileName() : "附件";
            String href = f.getFileUrl();
            if (href == null || href.isBlank()) {
                href = f.getFilePath();
            }
            sb.append("<li>");
            if (href != null && !href.isBlank() && isLikelyImage(name, href) && safeImgSrc(href) != null) {
                sb.append("<div class=\"figure-grid\" style=\"margin:0 0 8px 0;\"><figure style=\"max-width:320px;\">");
                sb.append("<img src=\"").append(safeImgSrc(href)).append("\" alt=\"").append(e(name)).append("\" loading=\"lazy\"/>");
                sb.append("<figcaption>");
                sb.append("<strong>").append(e(name)).append("</strong>");
                if (f.getFileType() != null && !f.getFileType().isBlank()) {
                    sb.append(" <span class=\"muted\">(").append(e(f.getFileType())).append(")</span>");
                }
                sb.append("</figcaption></figure></div>");
                sb.append("<a href=\"").append(e(href)).append("\" target=\"_blank\" rel=\"noopener noreferrer\">打开原图链接</a>");
            } else if (href != null && !href.isBlank()) {
                String safeHref = href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")
                        ? href
                        : null;
                if (safeHref != null) {
                    sb.append("<a href=\"").append(e(safeHref)).append("\" target=\"_blank\" rel=\"noopener noreferrer\">")
                            .append(e(name)).append("</a>");
                } else {
                    sb.append("<span>").append(e(name)).append("</span> <span class=\"muted\">（无可用外链）</span>");
                }
                if (f.getFileType() != null && !f.getFileType().isBlank()) {
                    sb.append(" <span class=\"muted\">").append(e(f.getFileType())).append("</span>");
                }
            } else {
                sb.append("<span>").append(e(name)).append("</span> <span class=\"muted\">（无 URL）</span>");
            }
            if (f.getUploadTime() != null && !f.getUploadTime().isBlank()) {
                sb.append(" <span class=\"muted\">").append(e(f.getUploadTime())).append("</span>");
            }
            sb.append("</li>\n");
        }
        sb.append("</ul>\n");
    }

    private static boolean isLikelyImage(String fileName, String url) {
        String probe = ((fileName != null ? fileName : "") + " " + (url != null ? url : "")).toLowerCase();
        return probe.contains(".jpg") || probe.contains(".jpeg") || probe.contains(".png") || probe.contains(".gif")
                || probe.contains(".webp") || probe.contains(".bmp") || probe.contains(".svg")
                || probe.contains(".heic") || probe.contains(".avif");
    }

    private static String jsonBlockHtml(Object node) {
        if (node == null) {
            return "<p class=\"muted\">无</p>\n";
        }
        String text;
        if (node instanceof JsonNode jn) {
            text = jn.toPrettyString();
        } else {
            text = String.valueOf(node);
        }
        return "<pre>" + e(text) + "</pre>\n";
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

