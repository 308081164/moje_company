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
     * 是否向客户发起设计确认（会话设计稿卡片）。
     * 未传时：有 designImages 则视为提交（兼容旧客户端）；显式 false 则仅保存草稿。
     */
    private Boolean submitToCustomer;
    /**
     * 建模师驳回后的修改：不发给客户，直接交回建模师。
     */
    private Boolean submitToModeler;
}
