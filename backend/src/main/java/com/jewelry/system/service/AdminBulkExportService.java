package com.jewelry.system.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.admin.ModelingArchivesZipRequest;
import com.jewelry.system.dto.admin.OrderBulkExportPreviewRowDto;
import com.jewelry.system.dto.admin.OrderBulkZipRequest;
import com.jewelry.system.dto.modeling.ModelingArchiveComponentRowDto;
import com.jewelry.system.dto.modeling.ModelingArchiveDto;
import com.jewelry.system.dto.modeling.ModelingArchiveInlayRowDto;
import com.jewelry.system.entity.FileEntity;
import com.jewelry.system.entity.Order;
import com.jewelry.system.enums.FileRelatedType;
import com.jewelry.system.repository.FileEntityRepository;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.util.SecurityUtils;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
@RequiredArgsConstructor
public class AdminBulkExportService {

    private final OrderRepository orderRepository;
    private final FileEntityRepository fileEntityRepository;
    private final AliyunOssService aliyunOssService;
    private final ModelingArchiveService modelingArchiveService;
    private final ObjectMapper objectMapper;

    private void assertAdmin() {
        if (!"ADMIN".equals(SecurityUtils.currentRoleApi().orElse(""))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可执行批量导出");
        }
    }

    @Transactional(readOnly = true)
    public List<OrderBulkExportPreviewRowDto> previewOrdersForZip(OrderBulkZipRequest req) {
        assertAdmin();
        LocalDate start = parseDate(req.getStartDate());
        LocalDate end = parseDate(req.getEndDate());
        List<Order> orders = orderRepository.findAll(ordersSpec(start, end, req.getSegment()));
        return orders.stream().map(this::toPreviewRow).toList();
    }

    private OrderBulkExportPreviewRowDto toPreviewRow(Order o) {
        return OrderBulkExportPreviewRowDto.builder()
                .orderId(o.getId())
                .orderNumber(o.getOrderNumber())
                .status(o.getStatus() != null ? o.getStatus().name() : "")
                .b2b(Boolean.TRUE.equals(o.getIsB2b()))
                .createdAt(o.getCreatedAt() != null ? o.getCreatedAt().toString() : "")
                .customerName(o.getCustomerName())
                .customerPhone(o.getCustomerPhone())
                .build();
    }

    @Transactional(readOnly = true)
    public byte[] zipOrders(OrderBulkZipRequest req) throws IOException {
        assertAdmin();
        LocalDate start = parseDate(req.getStartDate());
        LocalDate end = parseDate(req.getEndDate());
        List<Order> orders = orderRepository.findAll(ordersSpec(start, end, req.getSegment()));
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(bos)) {
            StringBuilder csv = new StringBuilder();
            csv.append("orderId,orderNumber,status,isB2b,createdAt,customerName,customerContact\n");
            for (Order o : orders) {
                csv.append(o.getId()).append(',');
                csv.append(escCsv(o.getOrderNumber())).append(',');
                csv.append(o.getStatus() != null ? o.getStatus().name() : "").append(',');
                csv.append(Boolean.TRUE.equals(o.getIsB2b()) ? "1" : "0").append(',');
                csv.append(o.getCreatedAt() != null ? o.getCreatedAt().toString() : "").append(',');
                csv.append(escCsv(o.getCustomerName())).append(',');
                csv.append(escCsv(o.getCustomerPhone())).append('\n');
                String prefix = "orders/ord_" + o.getId() + "_" + safeName(o.getOrderNumber()) + "/";
                addZipText(zos, prefix + "summary.txt", summaryText(o));
                List<FileEntity> files = fileEntityRepository.findByRelatedTypeAndRelatedIdOrderByIdDesc(FileRelatedType.ORDER, o.getId());
                int i = 0;
                for (FileEntity f : files) {
                    i++;
                    String fn = "attach_" + i + "_" + safeName(f.getFileName());
                    addOssFile(zos, prefix + "attachments/" + fn, f);
                }
            }
            addZipText(zos, "orders_index.csv", csv.toString());
            zos.finish();
        }
        return bos.toByteArray();
    }

    private static String summaryText(Order o) {
        return "orderId=" + o.getId() + "\norderNumber=" + o.getOrderNumber() + "\nstatus=" + o.getStatus()
                + "\nisB2b=" + o.getIsB2b() + "\ncustomerName=" + o.getCustomerName() + "\n";
    }

    @Transactional(readOnly = true)
    public byte[] zipModelingArchives(ModelingArchivesZipRequest req) throws IOException {
        assertAdmin();
        if (req.getOrderIds() == null || req.getOrderIds().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请至少选择一个订单");
        }
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(bos)) {
            for (Long orderId : req.getOrderIds()) {
                ModelingArchiveDto dto;
                try {
                    dto = modelingArchiveService.getArchive(orderId);
                } catch (ResponseStatusException ex) {
                    continue;
                }
                String base = "modeling_archives/ord_" + orderId + "/";
                addZipText(zos, base + "archive.json", objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(dto));
                Set<Long> fileIds = collectMarkerFileIds(dto);
                int n = 0;
                for (Long fid : fileIds) {
                    n++;
                    int finalN = n;
                    fileEntityRepository.findById(fid).ifPresent(f ->
                            addOssFile(zos, base + "markers/marker_" + finalN + "_" + safeName(f.getFileName()), f));
                }
                List<FileEntity> orderFiles = fileEntityRepository.findByRelatedTypeAndRelatedIdOrderByIdDesc(FileRelatedType.ORDER, orderId);
                int m = 0;
                for (FileEntity f : orderFiles) {
                    if (f.getFileType() != null && (f.getFileType().startsWith("MODEL") || f.getFileType().equals("ARCHIVE_MARKER"))) {
                        m++;
                        int finalM = m;
                        addOssFile(zos, base + "order_files/model_" + finalM + "_" + safeName(f.getFileName()), f);
                    }
                }
            }
            zos.finish();
        }
        return bos.toByteArray();
    }

    private static Set<Long> collectMarkerFileIds(ModelingArchiveDto dto) {
        Set<Long> ids = new HashSet<>();
        addIds(ids, dto.getMainMarkerFileIds());
        addIds(ids, dto.getTextureMarkerFileIds());
        if (dto.getComponents() != null) {
            for (ModelingArchiveComponentRowDto r : dto.getComponents()) {
                if (r.getMarkerFileIds() != null) {
                    ids.addAll(r.getMarkerFileIds());
                }
            }
        }
        if (dto.getInlays() != null) {
            for (ModelingArchiveInlayRowDto r : dto.getInlays()) {
                if (r.getMarkerFileIds() != null) {
                    ids.addAll(r.getMarkerFileIds());
                }
            }
        }
        return ids;
    }

    private static void addIds(Set<Long> ids, List<Long> list) {
        if (list != null) {
            ids.addAll(list);
        }
    }

    private void addOssFile(ZipOutputStream zos, String entryName, FileEntity f) {
        if (f.getFilePath() == null || f.getFilePath().isBlank() || !aliyunOssService.isEnabled()) {
            return;
        }
        try {
            byte[] bytes = aliyunOssService.readObjectBytes(f.getFilePath());
            zos.putNextEntry(new ZipEntry(entryName));
            zos.write(bytes);
            zos.closeEntry();
        } catch (Exception e) {
            try {
                zos.putNextEntry(new ZipEntry(entryName + ".error.txt"));
                zos.write(("读取失败: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
                zos.closeEntry();
            } catch (IOException ignored) {
            }
        }
    }

    private static void addZipText(ZipOutputStream zos, String entryName, String text) throws IOException {
        zos.putNextEntry(new ZipEntry(entryName));
        zos.write(text.getBytes(StandardCharsets.UTF_8));
        zos.closeEntry();
    }

    private static String escCsv(String s) {
        if (s == null) {
            return "";
        }
        String t = s.replace("\"", "\"\"");
        if (t.contains(",") || t.contains("\"") || t.contains("\n")) {
            return "\"" + t + "\"";
        }
        return t;
    }

    private static String safeName(String s) {
        if (s == null || s.isBlank()) {
            return "x";
        }
        String t = s.replaceAll("[^a-zA-Z0-9._\\-\\u4e00-\\u9fa5]+", "_");
        return t.length() > 80 ? t.substring(0, 80) : t;
    }

    private static LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(s.trim());
        } catch (DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "日期格式须为 yyyy-MM-dd: " + s);
        }
    }

    private Specification<Order> ordersSpec(LocalDate start, LocalDate end, String segment) {
        return (root, q, cb) -> {
            List<Predicate> preds = new ArrayList<>();
            if (start != null) {
                preds.add(cb.greaterThanOrEqualTo(root.get("createdAt"), start.atStartOfDay()));
            }
            if (end != null) {
                preds.add(cb.lessThan(root.get("createdAt"), end.plusDays(1).atStartOfDay()));
            }
            if (segment != null) {
                String seg = segment.trim().toUpperCase();
                if ("B2B".equals(seg)) {
                    preds.add(cb.isTrue(root.get("isB2b")));
                } else if ("C2C".equals(seg) || "C".equals(seg)) {
                    preds.add(cb.or(cb.isFalse(root.get("isB2b")), cb.isNull(root.get("isB2b"))));
                }
            }
            if (preds.isEmpty()) {
                return cb.conjunction();
            }
            return cb.and(preds.toArray(new Predicate[0]));
        };
    }
}
