package com.jewelry.system.controller;

import com.jewelry.system.dto.settlement.ModelSettlementItemDto;
import com.jewelry.system.dto.settlement.ModelSettlementSaveRequest;
import com.jewelry.system.service.ModelSettlementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/admin/settlements")
@RequiredArgsConstructor
@Tag(name = "管理员核算", description = "按飞书计件规则核算建模")
public class ModelSettlementController {

    private final ModelSettlementService modelSettlementService;

    @GetMapping("/model")
    @Operation(summary = "待核算与已核算的建模单件")
    public List<ModelSettlementItemDto> listModel() {
        return modelSettlementService.list();
    }

    @PutMapping("/model/{pieceId}")
    @Operation(summary = "保存一件的建模核算")
    public ModelSettlementItemDto saveModel(@PathVariable long pieceId, @RequestBody ModelSettlementSaveRequest body) {
        return modelSettlementService.save(pieceId, body);
    }
}
