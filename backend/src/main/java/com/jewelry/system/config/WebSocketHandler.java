package com.jewelry.system.config;

import com.jewelry.system.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;

@Slf4j
@RequiredArgsConstructor
public class WebSocketHandler extends TextWebSocketHandler {

    private final WebSocketService webSocketService;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        Map<String, Object> attributes = session.getAttributes();
        Long userId = (Long) attributes.get("userId");
        String role = (String) attributes.get("role");

        if (userId != null && role != null) {
            if ("MODELER".equals(role)) {
                webSocketService.registerModelerSession(userId, session);
            } else if ("ADMIN".equals(role)) {
                webSocketService.registerAdminSession(userId, session);
            }
        }
    }

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        log.debug("收到WebSocket消息: {}", message.getPayload());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        Map<String, Object> attributes = session.getAttributes();
        Long userId = (Long) attributes.get("userId");
        String role = (String) attributes.get("role");

        if (userId != null && role != null) {
            if ("MODELER".equals(role)) {
                webSocketService.unregisterModelerSession(userId);
            } else if ("ADMIN".equals(role)) {
                webSocketService.unregisterAdminSession(userId);
            }
        }
    }
}