package com.jewelry.system.dto.conversation;

import lombok.Data;

import java.util.List;

@Data
public class ConversationSendMessageRequest {
    private String content;
    /** text / image / file，默认 text */
    private String msgType;
    private List<Long> fileIds;
    /**
     * 仅管理员代发时有效：SUPER_SERVICE（默认）、DESIGNER、MODELER。
     * 客户侧展示为对应岗位负责人姓名。
     */
    private String chatAsRole;
}
