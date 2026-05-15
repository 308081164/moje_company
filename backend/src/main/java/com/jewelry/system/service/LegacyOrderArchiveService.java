package com.jewelry.system.service;

import com.jewelry.system.dto.legacy.LegacyOrderArchiveDto;
import com.jewelry.system.dto.legacy.LegacyOrderArchiveUpsertRequest;
import com.jewelry.system.entity.LegacyOrderArchive;
import com.jewelry.system.entity.User;
import com.jewelry.system.enums.LegacyOrderSegment;
import com.jewelry.system.repository.LegacyOrderArchiveRepository;
import com.jewelry.system.repository.UserRepository;
import com.jewelry.system.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.HexFormat;

@Service
@RequiredArgsConstructor
public class LegacyOrderArchiveService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final SecureRandom RND = new SecureRandom();

    private final LegacyOrderArchiveRepository legacyOrderArchiveRepository;
    private final UserRepository userRepository;

    private void assertAdmin() {
        if (!"ADMIN".equals(SecurityUtils.currentRoleApi().orElse(null))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可管理历史订单归档");
        }
    }

    @Transactional(readOnly = true)
    public Page<LegacyOrderArchiveDto> page(String keyword, LegacyOrderSegment segment, Pageable pageable) {
        assertAdmin();
        String kw = keyword != null && !keyword.isBlank() ? keyword.trim() : "";
        LegacyOrderSegment seg = segment;
        return legacyOrderArchiveRepository.pageSearch(kw, seg, pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public LegacyOrderArchiveDto get(long id) {
        assertAdmin();
        return legacyOrderArchiveRepository.findById(id).map(this::toDto)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "归档记录不存在"));
    }

    @Transactional
    public LegacyOrderArchiveDto create(LegacyOrderArchiveUpsertRequest req) {
        assertAdmin();
        long uid = SecurityUtils.currentStaffUserId()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        User u = userRepository.getReferenceById(uid);
        LegacyOrderArchive a = new LegacyOrderArchive();
        a.setArchiveCode(nextArchiveCode());
        a.setCreatedBy(u);
        apply(a, req);
        return toDto(legacyOrderArchiveRepository.save(a));
    }

    @Transactional
    public LegacyOrderArchiveDto update(long id, LegacyOrderArchiveUpsertRequest req) {
        assertAdmin();
        LegacyOrderArchive a = legacyOrderArchiveRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "归档记录不存在"));
        apply(a, req);
        return toDto(legacyOrderArchiveRepository.save(a));
    }

    private void apply(LegacyOrderArchive a, LegacyOrderArchiveUpsertRequest req) {
        a.setSegment(req.getSegment() != null ? req.getSegment() : LegacyOrderSegment.UNKNOWN);
        a.setCustomerName(req.getCustomerName());
        a.setCustomerPhone(req.getCustomerPhone());
        a.setCustomerWechat(req.getCustomerWechat());
        a.setOrderDate(parseDay(req.getOrderDate()));
        a.setCompletedDate(parseDay(req.getCompletedDate()));
        a.setStyleSummary(req.getStyleSummary());
        a.setMaterialSummary(req.getMaterialSummary());
        a.setRequirements(req.getRequirements());
        a.setDesignNotes(req.getDesignNotes());
        a.setModelingNotes(req.getModelingNotes());
        a.setQuotationNotes(req.getQuotationNotes());
        a.setAttachmentsJson(req.getAttachmentsJson());
        a.setInternalRemark(req.getInternalRemark());
    }

    private LocalDate parseDay(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(s.trim(), DAY);
        } catch (DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "日期格式应为 yyyy-MM-dd: " + s);
        }
    }

    private String nextArchiveCode() {
        byte[] buf = new byte[3];
        RND.nextBytes(buf);
        String rand = HexFormat.of().formatHex(buf);
        return "ARC" + java.time.LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + rand;
    }

    private LegacyOrderArchiveDto toDto(LegacyOrderArchive a) {
        User by = a.getCreatedBy();
        return LegacyOrderArchiveDto.builder()
                .id(a.getId())
                .archiveCode(a.getArchiveCode())
                .segment(a.getSegment())
                .customerName(a.getCustomerName())
                .customerPhone(a.getCustomerPhone())
                .customerWechat(a.getCustomerWechat())
                .orderDate(a.getOrderDate() != null ? a.getOrderDate().toString() : null)
                .completedDate(a.getCompletedDate() != null ? a.getCompletedDate().toString() : null)
                .styleSummary(a.getStyleSummary())
                .materialSummary(a.getMaterialSummary())
                .requirements(a.getRequirements())
                .designNotes(a.getDesignNotes())
                .modelingNotes(a.getModelingNotes())
                .quotationNotes(a.getQuotationNotes())
                .attachmentsJson(a.getAttachmentsJson())
                .internalRemark(a.getInternalRemark())
                .createdAt(a.getCreatedAt() != null ? a.getCreatedAt().toString() : null)
                .updatedAt(a.getUpdatedAt() != null ? a.getUpdatedAt().toString() : null)
                .createdByName(by != null
                        ? (by.getRealName() != null && !by.getRealName().isBlank()
                        ? by.getRealName()
                        : by.getUsername())
                        : null)
                .build();
    }
}
