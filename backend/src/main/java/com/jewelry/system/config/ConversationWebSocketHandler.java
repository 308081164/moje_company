package com.jewelry.system.config;

import com.jewelry.system.security.AccountKind;
import com.jewelry.system.service.ConversationSocketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * 站内聊天 WebSocket 处理器：连接登记、应用层 ping/pong，消息收发走 REST + 服务端推送。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ConversationWebSocketHandler extends TextWebSocketHandler {

    private final ConversationSocketService socketService;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        AccountKind type = (AccountKind) session.getAttributes().get("accountType");
        Long accountId = (Long) session.getAttributes().get("accountId");
        if (type != null && accountId != null) {
            socketService.register(type, accountId, session);
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            if (message == null || !message.isLast()) {
                return;
            }
            String payload = message.getPayload();
            if (payload == null) {
                return;
            }
            String trimmed = payload.trim();
            boolean ping = "ping".equalsIgnoreCase(trimmed) || trimmed.contains("\"ping\"");
            if (!ping) {
                return;
            }
            AccountKind type = (AccountKind) session.getAttributes().get("accountType");
            Long accountId = (Long) session.getAttributes().get("accountId");
            socketService.heartbeat(type, accountId, session);
            socketService.sendRaw(session, "{\"type\":\"pong\"}");
        } catch (Exception e) {
            log.warn("处理聊天心跳失败: {}", e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        AccountKind type = (AccountKind) session.getAttributes().get("accountType");
        Long accountId = (Long) session.getAttributes().get("accountId");
        if (type != null && accountId != null) {
            socketService.unregister(type, accountId, session);
        }
    }
}
