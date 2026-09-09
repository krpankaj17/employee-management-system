package com.datansh.EmployeeManagment.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

@Component
public class JwtUtils {

    @Value("${app.jwt.secret:e83b4cf7d9021a8c3214589d9e07890123456789abcdef0123456789abcdef01}")
    private String jwtSecret;

    @Value("${app.jwt.access-expiration-ms:3600000}")
    private long jwtAccessExpirationMs;

    @Value("${app.jwt.refresh-expiration-ms:604800000}")
    private long jwtRefreshExpirationMs;

    private SecretKey getSigningKey() {
        byte[] keyBytes;
        try {
            keyBytes = java.util.HexFormat.of().parseHex(jwtSecret);
        } catch (Exception e) {
            keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        }
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateAccessToken(UUID publicId, String email) {
        return generateAccessToken(publicId, email, 1);
    }

    public String generateAccessToken(UUID publicId, String email, Integer tokenVersion) {
        return Jwts.builder()
                .subject(publicId.toString())
                .claim("email", email)
                .claim("type", "access")
                .claim("token_version", tokenVersion != null ? tokenVersion : 1)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + jwtAccessExpirationMs))
                .signWith(getSigningKey(), Jwts.SIG.HS256)
                .compact();
    }

    public String generateRefreshToken(UUID publicId, String email) {
        return generateRefreshToken(publicId, email, 1);
    }

    public String generateRefreshToken(UUID publicId, String email, Integer tokenVersion) {
        return Jwts.builder()
                .subject(publicId.toString())
                .claim("email", email)
                .claim("type", "refresh")
                .claim("token_version", tokenVersion != null ? tokenVersion : 1)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + jwtRefreshExpirationMs))
                .signWith(getSigningKey(), Jwts.SIG.HS256)
                .compact();
    }

    public Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String getPublicIdFromToken(String token) {
        return extractAllClaims(token).getSubject();
    }

    public String getEmailFromToken(String token) {
        return extractAllClaims(token).get("email", String.class);
    }

    public String getTokenType(String token) {
        return extractAllClaims(token).get("type", String.class);
    }

    public Integer getTokenVersion(String token) {
        Object ver = extractAllClaims(token).get("token_version");
        if (ver instanceof Number) {
            return ((Number) ver).intValue();
        }
        return 1;
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parser().verifyWith(getSigningKey()).build().parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

}
