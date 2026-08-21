package com.jewelry.system.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.entity.ConversationMember;
import com.jewelry.system.security.AccountKind;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 站内聊天 WebSocket 连接管理：按（账号类型 + 账号ID）维护会话，向会话成员推送消息。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationSocketService {

    private final ObjectMapper objectMapper;
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    public void register(AccountKind type, Long accountId, WebSocketSession session) {
        sessions.put(key(type, accountId), session);
        log.info("聊天连接已建立: {}", key(type, accountId));
    }

    public void unregister(AccountKind type, Long accountId) {
        sessions.remove(key(type, accountId));
        log.info("聊天连接已断开: {}", key(type, accountId));
    }

    public void send(AccountKind type, Long accountId, String eventType, Object data) {
        WebSocketSession session = sessions.get(key(type, accountId));
        sendToSession(session, eventType, data);
    }

    public void broadcast(List<ConversationMember> members, String eventType, Object data) {
        for (ConversationMember member : members) {
            send(member.getAccountType(), member.getAccountId(), eventType, data);
        }
    }

    private void sendToSession(WebSocketSession session, String eventType, Object data) {
        if (session == null || !session.isOpen()) {
            return;
        }
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", eventType);
            payload.put("data", data);
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(payload)));
        } catch (IOException e) {
            log.error("发送聊天推送失败", e);
        }
    }

    private static String key(AccountKind type, Long accountId) {
        return type.name() + ":" + accountId;
    }
}
