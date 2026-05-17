package com.jewelry.system.config;

import com.jewelry.system.security.JwtAuthenticationFilter;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/auth/login", "/auth/refresh-token").permitAll()
                        .requestMatchers("/actuator/health", "/health", "/error").permitAll()
                        .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()
                        .requestMatchers("/b2b/client/register", "/b2b/client/login").permitAll()
                        .requestMatchers("/portal/c/account/register", "/portal/c/account/login").permitAll()
                        .requestMatchers(new AntPathRequestMatcher("/public/customer-order/*/hint", HttpMethod.GET.name())).permitAll()
                        .requestMatchers("/public/portal/**").permitAll()
                        // 勿使用 /b2b/order/{token} 匹配所有方法：会把 POST /b2b/order/create、create-with-files 当成「匿名 token 路径」放行，导致未注入 JWT 时以匿名身份进入接口并返回 401。
                        .requestMatchers(HttpMethod.POST, "/b2b/order/create", "/b2b/order/create-with-files").authenticated()
                        .requestMatchers(HttpMethod.GET, "/b2b/order/{token}").permitAll()
                        .requestMatchers(HttpMethod.GET, "/b2b/order/{token}/files").permitAll()
                        .requestMatchers("/b2b/modeler/status").permitAll()
                        // WebSocket 握手无法带 Authorization；路径为 context-path 下的 /ws/**
                        .requestMatchers("/ws/**").permitAll()
                        .anyRequest().authenticated()
                )
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType("application/json;charset=UTF-8");
                            response.getWriter().write("{\"message\":\"未认证或令牌无效\"}");
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.setContentType("application/json;charset=UTF-8");
                            response.getWriter().write("{\"message\":\"权限不足\"}");
                        })
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
