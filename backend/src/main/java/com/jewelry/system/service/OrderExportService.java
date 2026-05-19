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
    public byte[] exportOrderHtml(long orderId) {
        OrderInfoDto dto = orderQueryService.getOrder(orderId);
        List<FileInfoDto> files = orderFileService.listForOrder(orderId);
        String html = OrderHtmlWorksheetRenderer.render(dto, files);
        return html.getBytes(StandardCharsets.UTF_8);
    }
}
