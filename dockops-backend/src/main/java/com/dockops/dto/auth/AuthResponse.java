package com.dockops.dto.auth;

import com.dockops.entity.User;

import java.util.UUID;

public record AuthResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresIn,
        UUID userId,
        String username,
        String email,
        String fullName,
        User.Role role
) {
    public static AuthResponse of(String accessToken, String refreshToken, long expiresIn,
                                   User user) {
        return new AuthResponse(accessToken, refreshToken, "Bearer", expiresIn,
                user.getId(), user.getUsername(), user.getEmail(), user.getFullName(), user.getRole());
    }
}
