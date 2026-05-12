package com.jewelry.system.service;

import com.jewelry.system.dto.b2b.B2BOrderAccessDto;
import com.jewelry.system.entity.B2BClient;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.OrderAccessLink;
import com.jewelry.system.entity.OrderAccessLink.LinkStatus;
import com.jewelry.system.repository.OrderAccessLinkRepository;
import com.jewelry.system.repository.OrderRepository;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrderAccessLinkService {

    private final OrderAccessLinkRepository linkRepository;
    private final OrderRepository orderRepository;

    /** 完整前缀；非空时覆盖 {@link #publicBaseUrl} 拼接逻辑 */
    @Value("${app.b2b.access-url-prefix:}")
    private String accessUrlPrefix;

    /** 公网基址，无路径；与 server.servlet.context-path 及 B2B 路由组合为访问链接 */
    @Value("${app.b2b.public-base-url:http://localhost:8852}")
    private String publicBaseUrl;

    private static final String B2B_ORDER_ACCESS_PATH = "/api/b2b/order/";

    @Transactional
    public B2BOrderAccessDto createLink(Long orderId, Long clientId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));

        OrderAccessLink existing = linkRepository.findByOrderId(orderId).orElse(null);
        if (existing != null && LinkStatus.ACTIVE.equals(existing.getStatus())) {
            existing.setViewCount(0);
            existing.setExpireTime(LocalDateTime.now().plusDays(30));
            linkRepository.save(existing);
            return toDto(existing);
        }

        String token = UUID.randomUUID().toString().replace("-", "");
        String accessUrl = resolveAccessUrlPrefix() + token;

        OrderAccessLink link = new OrderAccessLink();
        link.setOrderId(orderId);
        link.setB2bClientId(clientId);
        link.setAccessToken(token);
        link.setExpireTime(LocalDateTime.now().plusDays(30));
        link.setViewCount(0);
        link.setQrcodeData(generateQrcodeBase64(accessUrl));

        linkRepository.save(link);
        return toDto(link);
    }

    public B2BOrderAccessDto getOrderAccessByToken(String token) {
        OrderAccessLink link = linkRepository.findByAccessToken(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "链接不存在或已过期"));

        if (!LinkStatus.ACTIVE.equals(link.getStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "链接已失效");
        }

        if (link.getExpireTime() != null && link.getExpireTime().isBefore(LocalDateTime.now())) {
            link.setStatus(LinkStatus.EXPIRED);
            linkRepository.save(link);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "链接已过期");
        }

        link.setViewCount(link.getViewCount() + 1);
        linkRepository.save(link);

        return toDto(link);
    }

    public Order getOrderEntityByToken(String token) {
        OrderAccessLink link = linkRepository.findByAccessToken(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "链接不存在"));

        if (!LinkStatus.ACTIVE.equals(link.getStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "链接已失效");
        }

        if (link.getExpireTime() != null && link.getExpireTime().isBefore(LocalDateTime.now())) {
            link.setStatus(LinkStatus.EXPIRED);
            linkRepository.save(link);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "链接已过期");
        }

        return orderRepository.findById(link.getOrderId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
    }

    @Transactional
    public void invalidateLink(Long orderId) {
        linkRepository.findByOrderId(orderId).ifPresent(link -> {
            link.setStatus(LinkStatus.DISABLED);
            linkRepository.save(link);
        });
    }

    /**
     * 返回以 / 结尾的完整前缀。若配置了 {@code app.b2b.access-url-prefix} 则直接使用；
     * 否则为 {@code publicBaseUrl} + {@code /api/b2b/order/}（与 context-path /api 及 {@code /b2b/order/{token}} 一致）。
     */
    private String resolveAccessUrlPrefix() {
        if (StringUtils.hasText(accessUrlPrefix)) {
            String p = accessUrlPrefix.trim();
            return p.endsWith("/") ? p : p + "/";
        }
        String base = publicBaseUrl == null ? "" : publicBaseUrl.trim();
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base + B2B_ORDER_ACCESS_PATH;
    }

    private String generateQrcodeBase64(String content) {
        try {
            Map<EncodeHintType, Object> hints = new HashMap<>();
            hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");
            hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M);
            hints.put(EncodeHintType.MARGIN, 1);

            QRCodeWriter qrCodeWriter = new QRCodeWriter();
            BitMatrix bitMatrix = qrCodeWriter.encode(content, BarcodeFormat.QR_CODE, 200, 200, hints);

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(bitMatrix, "PNG", outputStream);

            return "data:image/png;base64," + Base64.getEncoder().encodeToString(outputStream.toByteArray());
        } catch (WriterException | IOException e) {
            return null;
        }
    }

    private B2BOrderAccessDto toDto(OrderAccessLink link) {
        Order order = orderRepository.findById(link.getOrderId()).orElse(null);

        B2BOrderAccessDto dto = new B2BOrderAccessDto();
        dto.setOrderId(link.getOrderId());
        dto.setOrderNumber(order != null ? order.getOrderNumber() : null);
        dto.setAccessUrl(resolveAccessUrlPrefix() + link.getAccessToken());
        dto.setQrcodeBase64(link.getQrcodeData());
        dto.setExpireTime(link.getExpireTime());
        return dto;
    }
}