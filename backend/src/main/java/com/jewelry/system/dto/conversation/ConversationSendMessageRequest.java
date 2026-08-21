package com.jewelry.system.dto.conversation;

import lombok.Data;

import java.util.List;

@Data
public class ConversationSendMessageRequest {
    private String content;
    /** text / image / file，默认 text */
    private String msgType;
    private List<Long> fileIds;
}
