package com.jewelry.system.controller;

import com.jewelry.system.dto.legacy.LegacyOrderArchiveDto;
import com.jewelry.system.dto.legacy.LegacyOrderArchiveUpsertRequest;
import com.jewelry.system.enums.LegacyOrderSegment;
import com.jewelry.system.service.LegacyOrderArchiveService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admin/legacy-order-archives")
@RequiredArgsConstructor
@Tag(name = "历史订单归档", description = "管理员线下数据录入")
public class LegacyOrderArchiveController {

    private final LegacyOrderArchiveService legacyOrderArchiveService;

    @GetMapping
    @Operation(summary = "分页检索归档")
    public Page<LegacyOrderArchiveDto> page(
            Pageable pageable,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) LegacyOrderSegment segment
    ) {
        return legacyOrderArchiveService.page(keyword, segment, pageable);
    }

    @GetMapping("/{id}")
    public LegacyOrderArchiveDto get(@PathVariable long id) {
        return legacyOrderArchiveService.get(id);
    }

    @PostMapping
    public LegacyOrderArchiveDto create(@Valid @RequestBody LegacyOrderArchiveUpsertRequest body) {
        return legacyOrderArchiveService.create(body);
    }

    @PutMapping("/{id}")
    public LegacyOrderArchiveDto update(@PathVariable long id, @Valid @RequestBody LegacyOrderArchiveUpsertRequest body) {
        return legacyOrderArchiveService.update(id, body);
    }
}
