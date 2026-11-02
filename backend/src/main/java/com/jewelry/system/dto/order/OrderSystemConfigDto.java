package com.jewelry.system.dto.order;

import lombok.Data;

/** 与前端 orderService.getSystemConfig 返回结构一致 */
@Data
public class OrderSystemConfigDto {

    private double designBuyoutPrice;
    private double certificatePrice;
    private String silverPriceFormula;
    private String goldPriceFormula;
    /** 1 美元对应的人民币数量，用于跟单人民币报价换算给客户。 */
    private double cnyPerUsd;
}
