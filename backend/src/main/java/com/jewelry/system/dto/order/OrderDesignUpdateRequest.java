package com.jewelry.system.dto.order;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OrderDesignUpdateRequest {
    /** 单件 ID；不传则默认第一件 */
    private Long pieceId;
    private String engravingText;
    private List<String> engravingImages;
    private String materialType;
    private String materialDetail;
    private String handSize;
    /** 电镀 */
    private String plating;
    private Long designerId;
    private Object processInfo;
    private Object stoneInfo;
    private String designNotes;
    private List<String> designImages;
    /** 为 true 时写入历史版本快照（版本号自增） */
    private Boolean createVersion;
    /** 版本备注，如「客户驳回后修改」 */
    private String versionLabel;
    /**
     * 是否向客户发起设计确认。为 true 时按整单提交所有尚未确认的单件（每件一张卡片）；
     * 已确认的件跳过。未传时：有 designImages 则视为提交（兼容旧客户端）；显式 false 则仅保存当前件草稿。
     */
    private Boolean submitToCustomer;
    /**
     * 建模师驳回后的修改：不发给客户，直接交回建模师。
     */
    private Boolean submitToModeler;
}
