package com.jewelry.system.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class WebSocketService {

    private final ObjectMapper objectMapper;
    private final Map<Long, WebSocketSession> modelerSessions = new ConcurrentHashMap<>();
    private final Map<Long, WebSocketSession> adminSessions = new ConcurrentHashMap<>();

    public void registerModelerSession(Long userId, WebSocketSession session) {
        modelerSessions.put(userId, session);
        log.info("建模师 {} 已连接", userId);
    }

    public void unregisterModelerSession(Long userId) {
        modelerSessions.remove(userId);
        log.info("建模师 {} 已断开连接", userId);
    }

    public void registerAdminSession(Long userId, WebSocketSession session) {
        adminSessions.put(userId, session);
        log.info("管理员 {} 已连接", userId);
    }

    public void unregisterAdminSession(Long userId) {
        adminSessions.remove(userId);
        log.info("管理员 {} 已断开连接", userId);
    }

    public void sendMessageToModeler(Long userId, String type, Object data) {
        WebSocketSession session = modelerSessions.get(userId);
        if (session != null && session.isOpen()) {
            try {
                MessagePayload payload = new MessagePayload(type, data);
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(payload)));
                log.debug("发送消息给建模师 {}: {}", userId, type);
            } catch (IOException e) {
                log.error("发送消息给建模师 {} 失败", userId, e);
                unregisterModelerSession(userId);
            }
        }
    }

    public void sendMessageToAllModelers(String type, Object data) {
        modelerSessions.forEach((userId, session) -> {
            if (session.isOpen()) {
                try {
                    MessagePayload payload = new MessagePayload(type, data);
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(payload)));
                } catch (IOException e) {
                    log.error("发送消息给建模师 {} 失败", userId, e);
                    unregisterModelerSession(userId);
                }
            }
        });
    }

    public void sendMessageToAdmin(Long userId, String type, Object data) {
        WebSocketSession session = adminSessions.get(userId);
        if (session != null && session.isOpen()) {
            try {
                MessagePayload payload = new MessagePayload(type, data);
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(payload)));
                log.debug("发送消息给管理员 {}: {}", userId, type);
            } catch (IOException e) {
                log.error("发送消息给管理员 {} 失败", userId, e);
                unregisterAdminSession(userId);
            }
        }
    }

    public void sendMessageToAllAdmins(String type, Object data) {
        adminSessions.forEach((userId, session) -> {
            if (session.isOpen()) {
                try {
                    MessagePayload payload = new MessagePayload(type, data);
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(payload)));
                } catch (IOException e) {
                    log.error("发送消息给管理员 {} 失败", userId, e);
                    unregisterAdminSession(userId);
                }
            }
        });
    }

    public void notifyNewOrder(Long modelerId, Long orderId, String orderNumber) {
        Map<String, Object> data = Map.of(
            "orderId", orderId,
            "orderNumber", orderNumber
        );
        sendMessageToModeler(modelerId, "NEW_ORDER", data);
        sendMessageToAllAdmins("NEW_ORDER", data);
    }

    public void notifyOrderStatusChange(Long orderId, String status, String orderNumber) {
        Map<String, Object> data = Map.of(
            "orderId", orderId,
            "status", status,
            "orderNumber", orderNumber
        );
        sendMessageToAllModelers("ORDER_STATUS_CHANGE", data);
        sendMessageToAllAdmins("ORDER_STATUS_CHANGE", data);
    }

    public void notifyRejection(Long orderId, String orderNumber, String reason) {
        Map<String, Object> data = Map.of(
            "orderId", orderId,
            "orderNumber", orderNumber,
            "reason", reason
        );
        sendMessageToAllAdmins("ORDER_REJECTED", data);
    }

    public static class MessagePayload {
        private String type;
        private Object data;

        public MessagePayload() {}

        public MessagePayload(String type, Object data) {
            this.type = type;
            this.data = data;
        }

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public Object getData() { return data; }
        public void setData(Object data) { this.data = data; }
    }
}