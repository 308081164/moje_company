package com.jewelry.system.security;

import com.jewelry.system.entity.User;
import com.jewelry.system.util.ApiRoleMapper;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Date;

@Component
public class JwtTokenProvider {

    private static final String CLAIM_TYP = "typ";
    private static final String CLAIM_ROLE = "role";
    private static final String TYP_ACCESS = "access";
    private static final String TYP_REFRESH = "refresh";

    private final SecretKey key;
    private final long accessExpirationMs;
    private final long refreshExpirationMs;

    public long getAccessExpirationSeconds() {
        return accessExpirationMs / 1000;
    }

    public JwtTokenProvider(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration}") long accessExpirationMs,
            @Value("${jwt.refresh-expiration:604800000}") long refreshExpirationMs
    ) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("未配置 JWT 密钥：请设置环境变量 JWT_SECRET（或 Spring 配置 jwt.secret），长度建议不少于 32 字符。");
        }
        this.key = hmacKey(secret);
        this.accessExpirationMs = accessExpirationMs;
        this.refreshExpirationMs = refreshExpirationMs;
    }

    private static SecretKey hmacKey(String secret) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            try {
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                bytes = md.digest(bytes);
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }
        return Keys.hmacShaKeyFor(bytes);
    }

    public String createAccessToken(User user) {
        String roleApi = ApiRoleMapper.toApiRole(user.getRole());
        Date now = new Date();
        Date exp = new Date(now.getTime() + accessExpirationMs);
        return Jwts.builder()
                .setSubject(String.valueOf(user.getId()))
                .claim(CLAIM_TYP, TYP_ACCESS)
                .claim("username", user.getUsername())
                .claim(CLAIM_ROLE, roleApi)
                .claim("acct", "STAFF")
                .setIssuedAt(now)
                .setExpiration(exp)
                .signWith(key)
                .compact();
    }

    public String createB2BAccessToken(Long clientId, String contact) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + accessExpirationMs);
        return Jwts.builder()
                .setSubject(String.valueOf(clientId))
                .claim(CLAIM_TYP, TYP_ACCESS)
                .claim("username", contact)
                .claim(CLAIM_ROLE, "B2B_CLIENT")
                .claim("isB2B", true)
                .claim("acct", "B2B")
                .setIssuedAt(now)
                .setExpiration(exp)
                .signWith(key)
                .compact();
    }

    public String createPortalCustomerAccessToken(Long portalCustomerId, String contact) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + accessExpirationMs);
        return Jwts.builder()
                .setSubject(String.valueOf(portalCustomerId))
                .claim(CLAIM_TYP, TYP_ACCESS)
                .claim("username", contact)
                .claim(CLAIM_ROLE, "C_PORTAL_CUSTOMER")
                .claim("acct", "C_PORTAL")
                .setIssuedAt(now)
                .setExpiration(exp)
                .signWith(key)
                .compact();
    }

    public String createRefreshToken(User user) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + refreshExpirationMs);
        return Jwts.builder()
                .setSubject(String.valueOf(user.getId()))
                .claim(CLAIM_TYP, TYP_REFRESH)
                .setIssuedAt(now)
                .setExpiration(exp)
                .signWith(key)
                .compact();
    }

    public Claims parseAccessToken(String token) {
        Claims claims = parseClaims(token);
        if (!TYP_ACCESS.equals(claims.get(CLAIM_TYP))) {
            throw new MalformedJwtException("非 access token");
        }
        return claims;
    }

    public Claims parseRefreshToken(String token) {
        Claims claims = parseClaims(token);
        if (!TYP_REFRESH.equals(claims.get(CLAIM_TYP))) {
            throw new MalformedJwtException("非 refresh token");
        }
        return claims;
    }

    private Claims parseClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}
