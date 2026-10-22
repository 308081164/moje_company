package com.jewelry.system.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.entity.ConversationMember;
import com.jewelry.system.security.AccountKind;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * 站内聊天 WebSocket 连接管理：按（账号类型 + 账号ID）维护会话，向会话成员推送消息。
 * 浏览器无法发送协议层 ping，客户端用文本 {"type":"ping"}，这里回 {"type":"pong"}。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationSocketService {

    /** 新客户端约 20 秒一次 ping；超过这个时间没有心跳就关掉，避免半开连接占着推送名额。 */
    private static final long STALE_AFTER_MS = 75_000L;
    /** 当前登记的连接若超过这个时间没有心跳，后来的 ping 可以把它换掉。 */
    private static final long TAKEOVER_AFTER_MS = 50_000L;

    private final ObjectMapper objectMapper;
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, Long> lastSeen = new ConcurrentHashMap<>();
    private final Map<String, Object> sendLocks = new ConcurrentHashMap<>();
    /** 只有发过应用层 ping 的连接才参与超时清理，避免把尚未升级的旧页面踢下线。 */
    private final Set<String> pinged = ConcurrentHashMap.newKeySet();
    private final ScheduledExecutorService sweeper = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread thread = new Thread(r, "conversation-ws-heartbeat");
        thread.setDaemon(true);
        return thread;
    });

    @PostConstruct
    public void startHeartbeatSweep() {
        sweeper.scheduleWithFixedDelay(this::closeStaleSessions, 30, 30, TimeUnit.SECONDS);
    }

    @PreDestroy
    public void stopHeartbeatSweep() {
        sweeper.shutdownNow();
    }

    public void register(AccountKind type, Long accountId, WebSocketSession session) {
        if (type == null || accountId == null || session == null) {
            return;
        }
        String accountKey = key(type, accountId);
        sessions.put(accountKey, session);
        lastSeen.put(session.getId(), System.currentTimeMillis());
        log.info("聊天连接已建立: {} session={}", accountKey, session.getId());
    }

    /**
     * 只移除「当前登记的那条」连接。重连时旧连接的 onClose 晚到，不能把新连接从映射里删掉。
     */
    public void unregister(AccountKind type, Long accountId, WebSocketSession session) {
        if (type == null || accountId == null || session == null) {
            return;
        }
        String accountKey = key(type, accountId);
        if (sessions.remove(accountKey, session)) {
            lastSeen.remove(session.getId());
            pinged.remove(session.getId());
            sendLocks.remove(session.getId());
            log.info("聊天连接已断开: {}", accountKey);
        }
    }

    /** 客户端 ping：刷新心跳，并在映射丢失或旧连接已死时把这条活连接登记回去。 */
    public void heartbeat(AccountKind type, Long accountId, WebSocketSession session) {
        if (type == null || accountId == null || session == null) {
            return;
        }
        long now = System.currentTimeMillis();
        lastSeen.put(session.getId(), now);
        pinged.add(session.getId());
        String accountKey = key(type, accountId);
        sessions.compute(accountKey, (ignored, current) -> {
            if (current == null || current == session || !current.isOpen()) {
                return session;
            }
            Long currentSeen = lastSeen.get(current.getId());
            if (currentSeen == null || now - currentSeen > TAKEOVER_AFTER_MS) {
                return session;
            }
            return current;
        });
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

    public void sendRaw(WebSocketSession session, String json) {
        if (session == null || !session.isOpen() || json == null) {
            return;
        }
        Object lock = sendLocks.computeIfAbsent(session.getId(), id -> new Object());
        boolean failed = false;
        synchronized (lock) {
            if (!session.isOpen()) {
                return;
            }
            try {
                session.sendMessage(new TextMessage(json));
            } catch (IOException e) {
                log.warn("发送聊天推送失败: {}", e.getMessage());
                failed = true;
            }
        }
        if (failed) {
            dropSession(session);
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
            sendRaw(session, objectMapper.writeValueAsString(payload));
        } catch (Exception e) {
            log.error("序列化聊天推送失败", e);
        }
    }

    private void dropSession(WebSocketSession session) {
        sessions.entrySet().removeIf(entry -> entry.getValue() == session);
        lastSeen.remove(session.getId());
        pinged.remove(session.getId());
        sendLocks.remove(session.getId());
        try {
            if (session.isOpen()) {
                session.close(CloseStatus.SERVER_ERROR);
            }
        } catch (IOException ignored) {
            // 连接已经不可用
        }
    }

    private void closeStaleSessions() {
        long now = System.currentTimeMillis();
        for (Map.Entry<String, WebSocketSession> entry : sessions.entrySet()) {
            WebSocketSession session = entry.getValue();
            if (session == null || !pinged.contains(session.getId())) {
                continue;
            }
            if (!session.isOpen()) {
                sessions.remove(entry.getKey(), session);
                continue;
            }
            Long seen = lastSeen.get(session.getId());
            if (seen == null || now - seen < STALE_AFTER_MS) {
                continue;
            }
            log.info("关闭心跳超时的聊天连接: {}", entry.getKey());
            try {
                session.close(CloseStatus.GOING_AWAY);
            } catch (IOException ignored) {
                // 下面会从映射移除
            }
            sessions.remove(entry.getKey(), session);
            pinged.remove(session.getId());
            lastSeen.remove(session.getId());
            sendLocks.remove(session.getId());
        }
    }

    private static String key(AccountKind type, Long accountId) {
        return type.name() + ":" + accountId;
    }
}
