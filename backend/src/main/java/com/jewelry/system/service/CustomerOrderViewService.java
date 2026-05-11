package com.jewelry.system.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import com.jewelry.system.dto.customer.CustomerOrderPublicDto;
import com.jewelry.system.dto.customer.CustomerOrderPublicMilestoneDto;
import com.jewelry.system.dto.customer.CustomerProgressLinkResponseDto;
import com.jewelry.system.entity.DesignInfo;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.OrderCustomerViewLink;
import com.jewelry.system.entity.OrderCustomerViewLink.LinkStatus;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.repository.DesignInfoRepository;
import com.jewelry.system.repository.OrderCustomerViewLinkRepository;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * C 端客户订单公开进度与设计师分享卡片。
 * <p>限流：可按 view_token 做 Bucket4j / Redis 计数（此处仅占位，未实现）。</p>
 */
@Service
@RequiredArgsConstructor
public class CustomerOrderViewService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final OrderCustomerViewLinkRepository linkRepository;
    private final OrderRepository orderRepository;
    private final DesignInfoRepository designInfoRepository;
    private final ObjectMapper objectMapper;

    @Value("${app.customer-order.public-frontend-base-url:http://localhost:5173}")
    private String publicFrontendBaseUrl;

    @Value("${app.customer-order.link-ttl-days:90}")
    private int linkTtlDays;

    public static String maskCustomerName(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String s = raw.trim();
        if (s.length() <= 1) {
            return "*";
        }
        return s.charAt(0) + "**";
    }

    @Transactional
    public CustomerProgressLinkResponseDto createOrRefreshLink(long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
        assertDesignerOrAdmin(order);
        OrderCustomerViewLink saved = upsertCustomerViewLink(orderId);
        return CustomerProgressLinkResponseDto.builder()
                .token(saved.getViewToken())
                .publicPageUrl(buildPublicPageUrl(saved.getViewToken()))
                .expiresAt(saved.getExpireTime() != null ? ISO.format(saved.getExpireTime()) : null)
                .build();
    }

    /**
     * 服务端合成「小名片」PNG（缩略图 + 文案 + 二维码）。若需更精美排版可改为模板引擎或 headless Chromium。
     */
    @Transactional(rollbackFor = Exception.class)
    public byte[] renderShareCardPng(long orderId) throws IOException {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
        assertDesignerOrAdmin(order);
        OrderCustomerViewLink link = upsertCustomerViewLink(orderId);
        if (link.getExpireTime() != null && link.getExpireTime().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "链接已过期，请重新生成");
        }
        String publicUrl = buildPublicPageUrl(link.getViewToken());
        DesignInfo di = designInfoRepository.findByOrderId(orderId).orElse(null);
        List<String> images = parseDesignImages(di);
        String thumbUrl = images.isEmpty() ? null : images.get(0);
        return composeCardPng(order, thumbUrl, publicUrl);
    }

    private OrderCustomerViewLink upsertCustomerViewLink(long orderId) {
        LocalDateTime exp = LocalDateTime.now().plusDays(Math.max(1, linkTtlDays));
        OrderCustomerViewLink link = linkRepository.findByOrderId(orderId).orElse(null);
        if (link != null && LinkStatus.ACTIVE.equals(link.getStatus())) {
            link.setExpireTime(exp);
            link.setStatus(LinkStatus.ACTIVE);
            return linkRepository.save(link);
        }
        if (link != null) {
            link.setViewToken(newSecureToken());
            link.setStatus(LinkStatus.ACTIVE);
            link.setExpireTime(exp);
            link.setViewCount(0);
            return linkRepository.save(link);
        }
        OrderCustomerViewLink created = new OrderCustomerViewLink();
        created.setOrderId(orderId);
        created.setViewToken(newSecureToken());
        created.setStatus(LinkStatus.ACTIVE);
        created.setExpireTime(exp);
        created.setViewCount(0);
        return linkRepository.save(created);
    }

    @Transactional
    public CustomerOrderPublicDto getPublicSummary(String token) {
        OrderCustomerViewLink link = findActiveLink(token);
        if (link.getExpireTime() != null && link.getExpireTime().isBefore(LocalDateTime.now())) {
            link.setStatus(LinkStatus.EXPIRED);
            linkRepository.save(link);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "链接已过期");
        }
        link.setViewCount(Optional.ofNullable(link.getViewCount()).orElse(0) + 1);
        linkRepository.save(link);

        Order order = orderRepository.findById(link.getOrderId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
        DesignInfo di = designInfoRepository.findByOrderId(order.getId()).orElse(null);
        List<String> images = parseDesignImages(di);
        String firstImg = images.isEmpty() ? null : images.get(0);

        return CustomerOrderPublicDto.builder()
                .orderNumber(order.getOrderNumber())
                .displayTitle(resolveDisplayTitle(order))
                .customerNameMasked(maskCustomerName(order.getCustomerName()))
                .createdAt(order.getCreatedAt() != null ? ISO.format(order.getCreatedAt()) : null)
                .currentStatus(order.getStatus().name())
                .currentStatusLabel(order.getStatus().getDescription())
                .firstDesignImageUrl(firstImg)
                .milestones(buildMilestones(order))
                .build();
    }

    private void assertDesignerOrAdmin(Order order) {
        String role = SecurityUtils.currentRoleApi().orElse("");
        Long uid = SecurityUtils.currentUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        if ("ADMIN".equals(role)) {
            return;
        }
        if ("DESIGNER".equals(role) && (order.getDesigner() == null || uid.equals(order.getDesigner().getId()))) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅订单设计师或管理员可生成客户进度链接");
    }

    private OrderCustomerViewLink findActiveLink(String token) {
        OrderCustomerViewLink link = linkRepository.findByViewToken(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "链接不存在"));
        if (!LinkStatus.ACTIVE.equals(link.getStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "链接已失效");
        }
        return link;
    }

    private String newSecureToken() {
        byte[] buf = new byte[24];
        SECURE_RANDOM.nextBytes(buf);
        return HexFormat.of().formatHex(buf);
    }

    private String buildPublicPageUrl(String token) {
        String base = publicFrontendBaseUrl == null ? "" : publicFrontendBaseUrl.trim();
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base + "/order-status/" + token;
    }

    private String resolveDisplayTitle(Order order) {
        if (StringUtils.hasText(order.getStyleInfo())) {
            return truncate(order.getStyleInfo().trim(), 80);
        }
        if (StringUtils.hasText(order.getBasicRequirements())) {
            return truncate(order.getBasicRequirements().trim().replaceAll("\\s+", " "), 80);
        }
        return order.getOrderNumber();
    }

    private static String truncate(String s, int max) {
        if (s.length() <= max) {
            return s;
        }
        return s.substring(0, max - 1) + "…";
    }

    private List<String> parseDesignImages(DesignInfo di) {
        if (di == null || di.getDesignImagesJson() == null || di.getDesignImagesJson().isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(
                    di.getDesignImagesJson().getBytes(StandardCharsets.UTF_8),
                    objectMapper.getTypeFactory().constructCollectionType(List.class, String.class)
            );
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<CustomerOrderPublicMilestoneDto> buildMilestones(Order o) {
        List<CustomerOrderPublicMilestoneDto> list = new ArrayList<>();
        addMilestone(list, "created", "订单创建", o.getCreatedAt());
        addMilestone(list, "order_time", "需求时间", o.getOrderTime());
        addMilestone(list, "design_done", "设计完成", o.getDesignCompletedTime());
        addMilestone(list, "model_done", "建模完成", o.getModelCompletedTime());
        addMilestone(list, "review_done", "工艺评审完成", o.getReviewCompletedTime());
        addMilestone(list, "prod_start", "生产开始", o.getProductionStartTime());
        addMilestone(list, "prod_done", "生产完成", o.getProductionCompletedTime());
        if (OrderStatus.CANCELLED.equals(o.getStatus()) && o.getCancelledTime() != null) {
            addMilestone(list, "cancelled", "已取消", o.getCancelledTime());
        }
        list.sort(Comparator.comparing(m -> m.getAt() == null ? "" : m.getAt()));
        return list;
    }

    private static void addMilestone(List<CustomerOrderPublicMilestoneDto> list, String code, String label, LocalDateTime at) {
        if (at == null) {
            return;
        }
        list.add(CustomerOrderPublicMilestoneDto.builder()
                .code(code)
                .label(label)
                .at(ISO.format(at))
                .build());
    }

    private byte[] composeCardPng(Order order, String thumbUrl, String qrContent) throws IOException {
        final int W = 360;
        final int H = 440;
        BufferedImage canvas = new BufferedImage(W, H, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = canvas.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, W, H);
        g.setColor(new Color(235, 237, 240));
        g.fillRect(0, 0, W, 56);
        g.setColor(new Color(24, 144, 255));
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 16));
        g.drawString("定制进度", 16, 36);

        int thumbSize = 96;
        BufferedImage thumb = loadThumbnail(thumbUrl, thumbSize);
        int y0 = 72;
        if (thumb != null) {
            g.drawImage(thumb, 16, y0, null);
        } else {
            g.setColor(new Color(245, 245, 245));
            g.fillRect(16, y0, thumbSize, thumbSize);
            g.setColor(new Color(160, 160, 160));
            g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 12));
            g.drawString("暂无预览", 38, y0 + thumbSize / 2);
        }

        g.setColor(Color.BLACK);
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 13));
        int tx = 16 + thumbSize + 12;
        int ty = y0 + 18;
        g.drawString("单号 " + order.getOrderNumber(), tx, ty);
        ty += 22;
        g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 12));
        String title = resolveDisplayTitle(order);
        drawFittedString(g, title, tx, ty, W - tx - 16);
        ty += 40;
        if (order.getCreatedAt() != null) {
            g.setColor(new Color(90, 90, 90));
            g.drawString("创建 " + ISO.format(order.getCreatedAt()), tx, ty);
            ty += 18;
        }
        g.setColor(new Color(24, 144, 255));
        g.drawString("状态：" + order.getStatus().getDescription(), tx, ty);

        int qrSize = 128;
        BufferedImage qr = encodeQr(qrContent, qrSize);
        g.drawImage(qr, W - 16 - qrSize, H - 16 - qrSize, null);
        g.setColor(new Color(130, 130, 130));
        g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 10));
        g.drawString("扫码查看进度", W - 16 - qrSize, H - 8);

        g.dispose();
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(canvas, "png", baos);
        return baos.toByteArray();
    }

    private static void drawFittedString(Graphics2D g, String text, int x, int y, int maxWidth) {
        FontMetrics fm = g.getFontMetrics();
        if (fm.stringWidth(text) <= maxWidth) {
            g.drawString(text, x, y);
            return;
        }
        String ell = "…";
        String s = text;
        while (s.length() > 1 && fm.stringWidth(s + ell) > maxWidth) {
            s = s.substring(0, s.length() - 1);
        }
        g.drawString(s + ell, x, y);
    }

    private BufferedImage loadThumbnail(String url, int size) {
        if (!StringUtils.hasText(url)) {
            return null;
        }
        try {
            HttpURLConnection conn = (HttpURLConnection) new URL(url.trim()).openConnection();
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(15000);
            conn.setRequestProperty("User-Agent", "JewelrySystemCard/1.0");
            try (InputStream in = conn.getInputStream()) {
                BufferedImage src = ImageIO.read(in);
                if (src == null) {
                    return null;
                }
                Image scaled = src.getScaledInstance(size, size, Image.SCALE_SMOOTH);
                BufferedImage out = new BufferedImage(size, size, BufferedImage.TYPE_INT_RGB);
                Graphics2D og = out.createGraphics();
                og.drawImage(scaled, 0, 0, null);
                og.dispose();
                return out;
            }
        } catch (Exception ignored) {
            return null;
        }
    }

    private BufferedImage encodeQr(String content, int size) throws IOException {
        try {
            Map<EncodeHintType, Object> hints = new HashMap<>();
            hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");
            hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M);
            hints.put(EncodeHintType.MARGIN, 1);
            QRCodeWriter writer = new QRCodeWriter();
            BitMatrix matrix = writer.encode(content, BarcodeFormat.QR_CODE, size, size, hints);
            return MatrixToImageWriter.toBufferedImage(matrix);
        } catch (WriterException e) {
            throw new IOException(e);
        }
    }
}
