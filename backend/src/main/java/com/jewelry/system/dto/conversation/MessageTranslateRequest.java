package com.jewelry.system.dto.conversation;

import lombok.Data;

@Data
public class MessageTranslateRequest {
    /** 目标语言，如 en / zh-CN */
    private String targetLang;
}
