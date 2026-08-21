package com.jewelry.system.config;

import com.jewelry.system.security.AccountKind;
import com.jewelry.system.security.JwtTokenProvider;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

/**
 * 站内聊天 WebSocket 握手拦截器：从 query 参数 token 解析 JWT，写入账号类型与 ID。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ConversationHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtTokenProvider jwtTokenProvider;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        if (!(request instanceof ServletServerHttpRequest servletRequest)) {
            return false;
        }
        String token = servletRequest.getServletRequest().getParameter("token");
        if (token == null || token.isBlank()) {
            log.warn("聊天握手失败：缺少 token");
            return false;
        }
        try {
            Claims claims = jwtTokenProvider.parseAccessToken(token);
            long accountId = Long.parseLong(claims.getSubject());
            String role = claims.get("role", String.class);
            String acct = claims.get("acct", String.class);
            AccountKind kind = AccountKind.fromClaims(acct, role);
            attributes.put("accountType", kind);
            attributes.put("accountId", accountId);
            return true;
        } catch (Exception e) {
            log.warn("聊天握手鉴权失败", e);
            return false;
        }
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // 无需处理
    }
}
