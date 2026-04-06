package com.jewelry.system.enums;

public enum OrderSource {
    DOUYIN("抖音"),
    BILIBILI("B站"),
    XIAOHONGSHU("小红书"),
    TAOBAO("淘宝"),
    XIANYU("咸鱼"),
    INFLUENCER("达人推荐");
    
    private final String description;
    
    OrderSource(String description) {
        this.description = description;
    }
    
    public String getDescription() {
        return description;
    }
    
    public static OrderSource fromString(String source) {
        for (OrderSource orderSource : OrderSource.values()) {
            if (orderSource.name().equalsIgnoreCase(source)) {
                return orderSource;
            }
        }
        throw new IllegalArgumentException("未知的订单来源: " + source);
    }
}