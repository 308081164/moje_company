package com.jewelry.system.service;

import com.jewelry.system.dto.order.FileInfoDto;
import com.jewelry.system.dto.order.OrderInfoDto;
import com.openhtmltopdf.outputdevice.helper.BaseRendererBuilder;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.util.List;

/**
 * 将 HTML 生产工单渲染为 PDF，嵌入 Noto Sans SC 避免中文乱码。
 */
@Service
@Slf4j
public class OrderPdfExportService {

    private static final String FONT_FAMILY = "Noto Sans SC";
    private static final String FONT_CLASSPATH = "fonts/NotoSansSC-Regular.otf";

    private final OrderQueryService orderQueryService;
    private final OrderFileService orderFileService;

    public OrderPdfExportService(OrderQueryService orderQueryService, OrderFileService orderFileService) {
        this.orderQueryService = orderQueryService;
        this.orderFileService = orderFileService;
    }

    public byte[] exportOrderPdf(long orderId) {
        OrderInfoDto dto = orderQueryService.getOrder(orderId);
        List<FileInfoDto> files = orderFileService.listForOrder(orderId);
        String html = OrderHtmlWorksheetRenderer.render(dto, files);
        return renderPdf(html);
    }

    public byte[] renderPdf(String html) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            ClassPathResource fontRes = new ClassPathResource(FONT_CLASSPATH);
            if (!fontRes.exists()) {
                throw new IllegalStateException("缺少中文字体 classpath:" + FONT_CLASSPATH);
            }
            builder.useFont(
                    () -> {
                        try {
                            return fontRes.getInputStream();
                        } catch (Exception e) {
                            throw new RuntimeException(e);
                        }
                    },
                    FONT_FAMILY,
                    400,
                    BaseRendererBuilder.FontStyle.NORMAL,
                    true
            );
            builder.toStream(out);
            builder.run();
            return out.toByteArray();
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("PDF render failed", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "PDF 导出失败: " + e.getMessage());
        }
    }
}
