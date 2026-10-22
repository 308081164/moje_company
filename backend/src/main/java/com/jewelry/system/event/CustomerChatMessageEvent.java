package com.jewelry.system.event;

/**
 * C 端客户在订单群聊发送文本消息后发布，供 AI 客服等异步处理。
 */
public record CustomerChatMessageEvent(Long conversationId, Long messageId) {}
