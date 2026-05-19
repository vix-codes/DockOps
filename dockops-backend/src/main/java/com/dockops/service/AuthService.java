package com.dockops.service;

import com.dockops.dto.auth.AuthResponse;
import com.dockops.dto.auth.LoginRequest;
import com.dockops.dto.auth.RegisterRequest;
import com.dockops.entity.User;
import com.dockops.exception.DockOpsException;
import com.dockops.repository.UserRepository;
import com.dockops.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;

    @Value("${app.jwt.expiration-ms}")
    private long jwtExpirationMs;

    @Transactional
    public AuthResponse login(LoginRequest request) {
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username(), request.password())
        );

        User user = userRepository.findByUsername(request.username())
                .orElseThrow(() -> DockOpsException.notFound("User", request.username()));

        user.setLastLoginAt(Instant.now());
        userRepository.save(user);

        String accessToken = jwtTokenProvider.generateToken(auth);
        String refreshToken = jwtTokenProvider.generateRefreshToken(request.username());

        log.info("User logged in: {}", user.getUsername());
        return AuthResponse.of(accessToken, refreshToken, jwtExpirationMs, user);
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw DockOpsException.conflict("Username already exists: " + request.username());
        }
        if (userRepository.existsByEmail(request.email())) {
            throw DockOpsException.conflict("Email already registered: " + request.email());
        }

        User.Role role = request.role() != null ? request.role() : User.Role.ROLE_OPERATOR;
        User user = User.builder()
                .username(request.username())
                .email(request.email())
                .passwordHash(passwordEncoder.encode(request.password()))
                .fullName(request.fullName())
                .role(role)
                .build();

        userRepository.save(user);
        log.info("New user registered: {} with role {}", user.getUsername(), role);

        String accessToken = jwtTokenProvider.generateTokenFromUsername(user.getUsername());
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getUsername());
        return AuthResponse.of(accessToken, refreshToken, jwtExpirationMs, user);
    }

    @Transactional
    public AuthResponse refreshToken(String refreshToken) {
        if (!jwtTokenProvider.validateToken(refreshToken)) {
            throw DockOpsException.unauthorized("Invalid or expired refresh token");
        }
        String username = jwtTokenProvider.getUsernameFromToken(refreshToken);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> DockOpsException.notFound("User", username));

        String newAccessToken = jwtTokenProvider.generateTokenFromUsername(username);
        String newRefreshToken = jwtTokenProvider.generateRefreshToken(username);
        return AuthResponse.of(newAccessToken, newRefreshToken, jwtExpirationMs, user);
    }
}
