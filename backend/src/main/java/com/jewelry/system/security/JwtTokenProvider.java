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
                .subject(String.valueOf(user.getId()))
                .claim(CLAIM_TYP, TYP_ACCESS)
                .claim("username", user.getUsername())
                .claim(CLAIM_ROLE, roleApi)
                .issuedAt(now)
                .expiration(exp)
                .signWith(key)
                .compact();
    }

    public String createRefreshToken(User user) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + refreshExpirationMs);
        return Jwts.builder()
                .subject(String.valueOf(user.getId()))
                .claim(CLAIM_TYP, TYP_REFRESH)
                .issuedAt(now)
                .expiration(exp)
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
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
