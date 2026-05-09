package com.jewelry.system.dto.order;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

/**
 * 从聊天截图解析出的订单草稿字段，与创建订单表单对齐；售前需人工核对后再提交。
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OrderDraftFromChatImageResponse {

    private String customerName;
    private String customerContact;
    private String customerWechat;
    /** 前端 OrderSource 枚举名，如 DOUYIN、OTHER */
    private String source;
    private String sourceDetail;
    private Double depositAmount;
    private String style;
    private String materialInfo;
    private String basicRequirements;
    /** yyyy-MM-dd HH:mm:ss，可空 */
    private String orderTime;
    /** 模型补充说明或解析提示 */
    private String aiParseNote;
}
