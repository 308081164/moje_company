package com.jewelry.system.service;

import com.jewelry.system.dto.order.MaterialConfigItemDto;
import com.jewelry.system.dto.order.OrderSystemConfigDto;
import com.jewelry.system.dto.order.ProcessConfigItemDto;
import com.jewelry.system.entity.MaterialConfigEntry;
import com.jewelry.system.entity.ProcessConfigEntry;
import com.jewelry.system.entity.SysConfig;
import com.jewelry.system.repository.MaterialConfigRepository;
import com.jewelry.system.repository.ProcessConfigRepository;
import com.jewelry.system.repository.SysConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrderConfigurationService {

    private static final String KEY_DESIGN_FEE = "price.design.copyright.fee";
    private static final String KEY_CERT_FEE = "price.appraisal.certificate.fee";
    private static final String KEY_SILVER = "price.silver.margin";
    private static final String KEY_GOLD = "price.gold.margin";

    private final SysConfigRepository sysConfigRepository;
    private final MaterialConfigRepository materialConfigRepository;
    private final ProcessConfigRepository processConfigRepository;

    @Transactional(readOnly = true)
    public OrderSystemConfigDto getOrderSystemConfig() {
        OrderSystemConfigDto dto = new OrderSystemConfigDto();
        dto.setDesignBuyoutPrice(parseDouble(readValue(KEY_DESIGN_FEE), 500));
        dto.setCertificatePrice(parseDouble(readValue(KEY_CERT_FEE), 300));
        dto.setSilverPriceFormula(readValue(KEY_SILVER, "0.035"));
        dto.setGoldPriceFormula(readValue(KEY_GOLD, "10"));
        return dto;
    }

    @Transactional
    public OrderSystemConfigDto updateOrderSystemConfig(Map<String, Object> body) {
        if (body.containsKey("designBuyoutPrice")) {
            upsertNumber(KEY_DESIGN_FEE, toBigDecimal(body.get("designBuyoutPrice")), "设计买断费用");
        }
        if (body.containsKey("certificatePrice")) {
            upsertNumber(KEY_CERT_FEE, toBigDecimal(body.get("certificatePrice")), "鉴定证书费用");
        }
        if (body.containsKey("silverPriceFormula")) {
            upsertString(KEY_SILVER, String.valueOf(body.get("silverPriceFormula")), "银价加价比例");
        }
        if (body.containsKey("goldPriceFormula")) {
            upsertString(KEY_GOLD, String.valueOf(body.get("goldPriceFormula")), "金价加价金额");
        }
        return getOrderSystemConfig();
    }

    @Transactional(readOnly = true)
    public List<MaterialConfigItemDto> listMaterials() {
        return materialConfigRepository.findAll().stream()
                .sorted(Comparator.comparing(m -> m.getSortOrder() == null ? 0 : m.getSortOrder()))
                .map(m -> {
                    MaterialConfigItemDto d = new MaterialConfigItemDto();
                    d.setType(m.getMaterialCode());
                    d.setName(m.getMaterialName());
                    d.setPriceFormula(m.getPriceFormula());
                    return d;
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public List<MaterialConfigItemDto> saveMaterials(List<MaterialConfigItemDto> items) {
        materialConfigRepository.deleteAll();
        int order = 0;
        for (MaterialConfigItemDto it : items) {
            MaterialConfigEntry e = new MaterialConfigEntry();
            e.setMaterialCode(it.getType() != null ? it.getType() : "MAT_" + order);
            e.setMaterialName(it.getName() != null ? it.getName() : e.getMaterialCode());
            e.setPriceFormula(it.getPriceFormula());
            e.setSortOrder(order++);
            e.setAvailable(true);
            materialConfigRepository.save(e);
        }
        return listMaterials();
    }

    @Transactional(readOnly = true)
    public List<ProcessConfigItemDto> listProcesses() {
        return processConfigRepository.findAll().stream()
                .sorted(Comparator.comparing(p -> p.getSortOrder() == null ? 0 : p.getSortOrder()))
                .map(p -> {
                    ProcessConfigItemDto d = new ProcessConfigItemDto();
                    d.setId(p.getId());
                    d.setProcessType("OTHER");
                    d.setCustomProcess(p.getProcessName());
                    d.setAdditionalCost(p.getDefaultFee() != null ? p.getDefaultFee().doubleValue() : 0d);
                    d.setNotes(p.getDescription());
                    return d;
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public List<ProcessConfigItemDto> saveProcesses(List<ProcessConfigItemDto> items) {
        processConfigRepository.deleteAll();
        int order = 0;
        for (ProcessConfigItemDto it : items) {
            ProcessConfigEntry e = new ProcessConfigEntry();
            e.setProcessName(it.getCustomProcess() != null ? it.getCustomProcess() : "工艺" + order);
            e.setDefaultFee(BigDecimal.valueOf(it.getAdditionalCost()));
            e.setDescription(it.getNotes());
            e.setSortOrder(order++);
            e.setAvailable(true);
            processConfigRepository.save(e);
        }
        return listProcesses();
    }

    private String readValue(String key, String defaultVal) {
        return sysConfigRepository.findByConfigKey(key)
                .map(SysConfig::getConfigValue)
                .orElse(defaultVal);
    }

    private double parseDouble(String raw, double defaultVal) {
        if (raw == null || raw.isBlank()) {
            return defaultVal;
        }
        try {
            return Double.parseDouble(raw.trim());
        } catch (NumberFormatException e) {
            return defaultVal;
        }
    }

    private void upsertNumber(String key, BigDecimal value, String description) {
        SysConfig row = sysConfigRepository.findByConfigKey(key).orElseGet(SysConfig::new);
        row.setConfigKey(key);
        row.setConfigValue(value != null ? value.toPlainString() : null);
        row.setConfigType(SysConfig.ConfigValueType.NUMBER);
        row.setDescription(description);
        sysConfigRepository.save(row);
    }

    private void upsertString(String key, String value, String description) {
        SysConfig row = sysConfigRepository.findByConfigKey(key).orElseGet(SysConfig::new);
        row.setConfigKey(key);
        row.setConfigValue(value);
        row.setConfigType(SysConfig.ConfigValueType.STRING);
        row.setDescription(description);
        sysConfigRepository.save(row);
    }

    private BigDecimal toBigDecimal(Object o) {
        if (o == null) {
            return BigDecimal.ZERO;
        }
        if (o instanceof Number n) {
            return BigDecimal.valueOf(n.doubleValue());
        }
        return new BigDecimal(String.valueOf(o));
    }
}
