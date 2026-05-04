package com.jewelry.system.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

@Slf4j
public class WebSocketHandshakeInterceptor implements HandshakeInterceptor {

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, 
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) throws Exception {
        
        if (request instanceof ServletServerHttpRequest) {
            ServletServerHttpRequest servletRequest = (ServletServerHttpRequest) request;
            String userIdStr = servletRequest.getServletRequest().getParameter("userId");
            String role = servletRequest.getServletRequest().getParameter("role");
            
            if (userIdStr != null && role != null) {
                try {
                    Long userId = Long.parseLong(userIdStr);
                    attributes.put("userId", userId);
                    attributes.put("role", role);
                    log.debug("WebSocket握手: userId={}, role={}", userId, role);
                } catch (NumberFormatException e) {
                    log.warn("WebSocket握手失败: userId格式错误");
                    return false;
                }
            } else {
                log.warn("WebSocket握手失败: userId或role参数缺失");
                return false;
            }
        }
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                              WebSocketHandler wsHandler, Exception exception) {
        // 无需处理
    }
}