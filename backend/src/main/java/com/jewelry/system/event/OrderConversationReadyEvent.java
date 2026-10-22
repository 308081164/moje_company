package com.jewelry.system.event;

/** 订单群聊已就绪（成员同步完成），可触发 AI 客服开场等。 */
public record OrderConversationReadyEvent(Long orderId) {}
