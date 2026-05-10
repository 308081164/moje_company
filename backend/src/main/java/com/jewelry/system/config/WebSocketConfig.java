package com.jewelry.system.config;

import com.jewelry.system.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private final WebSocketService webSocketService;

    // 生产在 server.servlet.context-path 下注册，客户端 URL 形如 wss://host/api/ws/modeler；Nginx 需 proxy_set_header Upgrade $http_upgrade; Connection "upgrade";

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(new WebSocketHandler(webSocketService), "/ws/modeler")
                .addInterceptors(new WebSocketHandshakeInterceptor())
                .setAllowedOrigins("*");
        registry.addHandler(new WebSocketHandler(webSocketService), "/ws/admin")
                .addInterceptors(new WebSocketHandshakeInterceptor())
                .setAllowedOrigins("*");
    }
}