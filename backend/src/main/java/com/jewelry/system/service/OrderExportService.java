package com.jewelry.system.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.order.FileInfoDto;
import com.jewelry.system.dto.order.OrderInfoDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

import com.jewelry.system.enums.OrderSource;
import com.jewelry.system.enums.OrderStatus;

import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class OrderExportService {

    private final OrderQueryService orderQueryService;
    private final OrderFileService orderFileService;
    private final ObjectMapper objectMapper;

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

    private String renderHtml(OrderInfoDto o, List<FileInfoDto> files) {
        String title = "定制订单单";
        if (o.getBaseInfo() != null && o.getBaseInfo().getOrderNumber() != null && !o.getBaseInfo().getOrderNumber().isBlank()) {
            title = e(o.getBaseInfo().getOrderNumber());
        }
        StringBuilder sb = new StringBuilder(8192);
        sb.append("<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n");
        sb.append("<meta charset=\"UTF-8\">\n");
        sb.append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n");
        sb.append("<title>").append(title).append(" — 客户工单</title>\n");
        sb.append("<style>\n");
        sb.append("body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;");
        sb.append("line-height:1.55;max-width:820px;margin:28px auto;padding:0 18px 48px;color:#1a1a1a;background:#fafafa;}\n");
        sb.append(".sheet{background:#fff;border-radius:12px;padding:22px 22px 8px;box-shadow:0 2px 12px rgba(0,0,0,.06);}\n");
        sb.append("h1{font-size:1.35rem;margin:0 0 4px;font-weight:700;letter-spacing:.02em;}\n");
        sb.append(".sub{color:#666;font-size:.9rem;margin:0 0 18px;}\n");
        sb.append("h2{font-size:1.08rem;margin:22px 0 10px;padding-bottom:6px;border-bottom:1px solid #eee;color:#333;}\n");
        sb.append("h3{font-size:1rem;margin:16px 0 8px;color:#333;}\n");
        sb.append("dl.kv{display:grid;grid-template-columns:minmax(120px,34%) 1fr;column-gap:12px;row-gap:6px;margin:0 0 8px;}\n");
        sb.append("dl.kv dt{margin:0;font-weight:600;color:#444;}\n");
        sb.append("dl.kv dd{margin:0;color:#222;word-break:break-word;}\n");
        sb.append(".note{margin:8px 0 0;padding:12px 14px;background:#f6f8fa;border:1px solid #e8eaed;border-radius:8px;");
        sb.append("white-space:pre-wrap;word-break:break-word;font-size:.92rem;}\n");
        sb.append(".muted{color:#777;font-size:.88rem;}\n");
        sb.append(".craft{margin:0 0 12px;padding:12px 14px;border:1px solid #e8e8e8;border-radius:10px;background:#fcfcfc;}\n");
        sb.append(".craft p{margin:4px 0;font-size:.92rem;}\n");
        sb.append(".figure-grid{display:flex;flex-wrap:wrap;gap:14px;margin:12px 0;align-items:flex-start;}\n");
        sb.append(".figure-grid figure{margin:0;max-width:min(100%,320px);border:1px solid #e1e4e8;border-radius:8px;");
        sb.append("padding:10px;background:#fafbfc;}\n");
        sb.append(".figure-grid img{max-width:100%;height:auto;display:block;border-radius:4px;}\n");
        sb.append(".figure-grid figcaption{font-size:0.82rem;color:#555;margin-top:8px;word-break:break-all;line-height:1.35;}\n");
        sb.append(".attach-list{list-style:none;padding:0;margin:0;}\n");
        sb.append(".attach-list li{margin:8px 0;padding:10px 12px;background:#f6f8fa;border:1px solid #e1e4e8;border-radius:8px;}\n");
        sb.append(".attach-list a{color:#0969da;text-decoration:none;word-break:break-all;}\n");
        sb.append(".attach-list a:hover{text-decoration:underline;}\n");
        sb.append("</style>\n</head>\n<body>\n<div class=\"sheet\">\n");
        sb.append("<h1>定制订单单</h1>\n");
        sb.append("<p class=\"sub\">供客户查阅的订单摘要（已隐藏内部岗位与系统编码类字段）。</p>\n");

        if (o.getBaseInfo() != null) {
            sb.append("<h2>订单概要</h2>\n<dl class=\"kv\">\n");
            rowHtml(sb, "订单号", o.getBaseInfo().getOrderNumber());
            rowHtml(sb, "客户称呼", o.getBaseInfo().getCustomerName());
            rowHtml(sb, "联系方式", o.getBaseInfo().getCustomerContact());
            if (o.getBaseInfo().getCustomerWechat() != null && !o.getBaseInfo().getCustomerWechat().isBlank()) {
                rowHtml(sb, "微信", o.getBaseInfo().getCustomerWechat());
            }
            rowHtml(sb, "订单来源", formatOrderSourceReadable(o.getBaseInfo().getSource()));
            if (o.getBaseInfo().getSourceDetail() != null && !o.getBaseInfo().getSourceDetail().isBlank()) {
                rowHtml(sb, "来源补充", o.getBaseInfo().getSourceDetail());
            }
            rowHtml(sb, "已付定金（元）", o.getBaseInfo().getDepositAmount() != null ? String.valueOf(o.getBaseInfo().getDepositAmount()) : "0");
            rowHtml(sb, "下单时间", o.getBaseInfo().getOrderTime());
            rowHtml(sb, "款式说明", o.getBaseInfo().getStyle());
            rowHtml(sb, "材质与金属", o.getBaseInfo().getMaterialInfo());
            sb.append("</dl>\n");
            sb.append("<h2>定制需求</h2>\n").append(noteBlockHtml(o.getBaseInfo().getBasicRequirements()));
        }

        if (o.getWecomJoinQrBase64() != null && !o.getWecomJoinQrBase64().isBlank()) {
            sb.append("<h2>专属服务群（微信扫码）</h2>\n");
            sb.append("<figure style=\"max-width:280px;margin:0;\"><img src=\"data:image/jpeg;base64,")
                    .append(o.getWecomJoinQrBase64())
                    .append("\" alt=\"微信群二维码\" style=\"max-width:100%;height:auto;border-radius:8px;border:1px solid #e1e4e8;\"/></figure>\n");
        }

        sb.append("<h2>当前进度</h2>\n<dl class=\"kv\">\n");
        rowHtml(sb, "进度阶段", formatOrderStatusReadable(o.getCurrentStatus()));
        rowHtml(sb, "最近更新", o.getUpdatedAt());
        sb.append("</dl>\n");

        if (o.getDesignInfo() != null) {
            sb.append("<h2>设计与尺寸</h2>\n<dl class=\"kv\">\n");
            rowHtml(sb, "字印 / 刻字", o.getDesignInfo().getEngravingText());
            rowHtml(sb, "主石与材质方案", o.getDesignInfo().getMaterialType());
            if (o.getDesignInfo().getMaterialDetail() != null && !o.getDesignInfo().getMaterialDetail().isBlank()) {
                rowHtml(sb, "材质明细", o.getDesignInfo().getMaterialDetail());
            }
            rowHtml(sb, "手寸 / 链长", o.getDesignInfo().getHandSize());
            sb.append("</dl>\n");
            sb.append("<h3>设计说明</h3>\n").append(noteBlockHtml(o.getDesignInfo().getDesignNotes()));
            appendProcessReadable(sb, o.getDesignInfo().getProcessInfo());
            appendStoneReadable(sb, o.getDesignInfo().getStoneInfo());
            appendImageGallery(sb, "款式参考图", o.getDesignInfo().getDesignImages());
        }
        if (o.getModelInfo() != null) {
            sb.append("<h2>建模与效果</h2>\n<dl class=\"kv\">\n");
            rowHtml(sb, "参考克重（克）", o.getModelInfo().getWeight() != null ? String.valueOf(o.getModelInfo().getWeight()) : "");
            sb.append("</dl>\n");
            sb.append("<h3>建模说明</h3>\n").append(noteBlockHtml(o.getModelInfo().getModelNotes()));
            appendImageGallery(sb, "三维效果图", o.getModelInfo().getModelEffectImages());
            appendModelFilesReadable(sb, o.getModelInfo().getModelFiles());
        }
        if (o.getReviewInfo() != null) {
            sb.append("<h2>工艺评审（客户可见结论）</h2>\n<dl class=\"kv\">\n");
            rowHtml(sb, "评审结论", Boolean.TRUE.equals(o.getReviewInfo().getReviewPassed()) ? "工艺方案已通过" : "需调整后再生产");
            rowHtml(sb, "调整说明", o.getReviewInfo().getRejectionReason());
            sb.append("</dl>\n");
            sb.append("<h3>评审备注</h3>\n").append(noteBlockHtml(o.getReviewInfo().getReviewNotes()));
        }
        if (o.getQuotationInfo() != null) {
            sb.append("<h2>费用合计</h2>\n<dl class=\"kv\">\n");
            rowHtml(sb, "合计金额（元）", o.getQuotationInfo().getTotalCost());
            sb.append("</dl>\n");
            sb.append("<h3>费用说明</h3>\n").append(noteBlockHtml(o.getQuotationInfo().getQuotationNotes()));
        }

        appendOrderAttachmentsHtml(sb, files);

        sb.append("</div>\n</body>\n</html>\n");
        return sb.toString();
    }

    private String formatOrderSourceReadable(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return OrderSource.fromString(raw.trim()).getDescription();
        } catch (Exception ignored) {
            return raw.trim();
        }
    }

    private String formatOrderStatusReadable(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return OrderStatus.fromString(raw.trim()).getDescription();
        } catch (Exception ignored) {
            return raw.trim();
        }
    }

    private void appendProcessReadable(StringBuilder sb, Object processInfo) {
        if (processInfo == null) {
            return;
        }
        JsonNode n = objectMapper.valueToTree(processInfo);
        if (n == null || n.isNull() || n.isMissingNode()) {
            return;
        }
        if (n.isArray() && n.size() == 0) {
            return;
        }
        sb.append("<h2>已选工艺</h2>\n");
        if (n.isArray()) {
            for (JsonNode item : n) {
                sb.append("<div class=\"craft\">");
                appendCraftItem(sb, item);
                sb.append("</div>\n");
            }
        } else {
            sb.append("<div class=\"craft\">");
            appendCraftItem(sb, n);
            sb.append("</div>\n");
        }
    }

    private static void appendCraftItem(StringBuilder sb, JsonNode item) {
        if (item == null || item.isNull()) {
            return;
        }
        String type = textOrEmpty(item.get("processType"));
        String custom = textOrEmpty(item.get("customProcess"));
        String notes = textOrEmpty(item.get("notes"));
        String add = textOrEmpty(item.get("additionalCost"));
        if (!type.isBlank()) {
            sb.append("<p><strong>工艺类型</strong> ").append(e(type)).append("</p>\n");
        }
        if (!custom.isBlank()) {
            sb.append("<p><strong>定制说明</strong> ").append(e(custom)).append("</p>\n");
        }
        if (!notes.isBlank()) {
            sb.append("<p><strong>补充备注</strong> ").append(e(notes)).append("</p>\n");
        }
        if (!add.isBlank()) {
            sb.append("<p><strong>附加费用（元）</strong> ").append(e(add)).append("</p>\n");
        }
    }

    private void appendStoneReadable(StringBuilder sb, Object stoneInfo) {
        if (stoneInfo == null) {
            return;
        }
        JsonNode n = objectMapper.valueToTree(stoneInfo);
        if (n == null || n.isNull() || n.isMissingNode()) {
            return;
        }
        if (n.isObject() && n.size() == 0) {
            return;
        }
        if (n.isArray() && n.size() == 0) {
            return;
        }
        sb.append("<h2>宝石与配石</h2>\n<div class=\"craft\">");
        if (n.isArray()) {
            int i = 0;
            for (JsonNode item : n) {
                i++;
                sb.append("<p><strong>配石 ").append(i).append("</strong></p>\n");
                appendStoneFields(sb, item);
            }
        } else {
            appendStoneFields(sb, n);
        }
        sb.append("</div>\n");
    }

    private static void appendStoneFields(StringBuilder sb, JsonNode node) {
        Iterator<Map.Entry<String, JsonNode>> it = node.properties().iterator();
        boolean any = false;
        while (it.hasNext()) {
            Map.Entry<String, JsonNode> en = it.next();
            String label = stoneFieldLabel(en.getKey());
            String val = textOrEmpty(en.getValue());
            if (val.isBlank()) {
                continue;
            }
            any = true;
            sb.append("<p><strong>").append(HtmlUtils.htmlEscape(label, "UTF-8")).append("</strong> ")
                    .append(e(val)).append("</p>\n");
        }
        if (!any) {
            sb.append("<p class=\"muted\">（无配石明细）</p>\n");
        }
    }

    private static String stoneFieldLabel(String key) {
        if (key == null) {
            return "";
        }
        return switch (key) {
            case "stoneName", "name" -> "宝石名称";
            case "stoneType", "type" -> "宝石类型";
            case "carat", "weight" -> "克拉 / 重量";
            case "quantity", "count" -> "数量";
            case "color" -> "颜色";
            case "clarity" -> "净度";
            case "cut" -> "切工";
            case "certificate" -> "证书";
            case "notes", "remark" -> "备注";
            default -> key;
        };
    }

    private void appendModelFilesReadable(StringBuilder sb, Object modelFiles) {
        if (modelFiles == null) {
            return;
        }
        JsonNode n = objectMapper.valueToTree(modelFiles);
        if (n == null || n.isNull() || !n.isArray() || n.size() == 0) {
            return;
        }
        sb.append("<h2>建模交付文件</h2>\n<ul class=\"attach-list\">\n");
        for (JsonNode f : n) {
            String name = textOrEmpty(f.get("fileName"));
            if (name.isBlank()) {
                name = "文件";
            }
            String url = textOrEmpty(f.get("fileUrl"));
            sb.append("<li>");
            if (!url.isBlank() && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//"))) {
                sb.append("<a href=\"").append(e(url)).append("\" target=\"_blank\" rel=\"noopener noreferrer\">")
                        .append(e(name)).append("</a>");
            } else {
                sb.append("<span>").append(e(name)).append("</span>");
            }
            sb.append("</li>\n");
        }
        sb.append("</ul>\n");
    }

    private static String textOrEmpty(JsonNode n) {
        if (n == null || n.isNull() || n.isMissingNode()) {
            return "";
        }
        if (n.isTextual()) {
            return n.asText("");
        }
        if (n.isNumber()) {
            return n.asText();
        }
        if (n.isBoolean()) {
            return n.asBoolean() ? "是" : "否";
        }
        return n.toString();
    }

    private static String noteBlockHtml(String s) {
        if (s == null || s.isBlank()) {
            return "<p class=\"muted\">无</p>\n";
        }
        return "<div class=\"note\">" + e(s) + "</div>\n";
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

