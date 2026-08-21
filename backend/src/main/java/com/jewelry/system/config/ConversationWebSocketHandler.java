package com.jewelry.system.config;

import com.jewelry.system.security.AccountKind;
import com.jewelry.system.service.ConversationSocketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * 站内聊天 WebSocket 处理器：仅负责建立/断开连接的注册，消息收发走 REST + 服务端推送。
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
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        AccountKind type = (AccountKind) session.getAttributes().get("accountType");
        Long accountId = (Long) session.getAttributes().get("accountId");
        if (type != null && accountId != null) {
            socketService.unregister(type, accountId);
        }
    }
}
