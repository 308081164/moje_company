package com.jewelry.system.enums;

public enum ProductionProcess {
    WAX("喷蜡"),
    CAST("倒模浇筑"),
    SETTING("宝石镶嵌"),
    ENAMEL("烤珐琅"),
    PLATING("电镀"),
    BRUSH("拉丝"),
    SAND("喷砂"),
    FINISH_MOLD("执模"),
    POLISH("抛光"),
    MICRO_PAVE("钉砂");

    private final String label;

    ProductionProcess(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    public static ProductionProcess fromCode(String code) {
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("请选择工序");
        }
        for (ProductionProcess process : values()) {
            if (process.name().equalsIgnoreCase(code.trim())) {
                return process;
            }
        }
        throw new IllegalArgumentException("未知工序: " + code);
    }
}
