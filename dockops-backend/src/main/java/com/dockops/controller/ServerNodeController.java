package com.dockops.controller;

import com.dockops.dto.server.ServerNodeRequest;
import com.dockops.dto.server.ServerNodeResponse;
import com.dockops.service.ServerNodeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/nodes")
@RequiredArgsConstructor
public class ServerNodeController {

    private final ServerNodeService serverNodeService;

    @GetMapping
    public ResponseEntity<List<ServerNodeResponse>> getAllNodes() {
        return ResponseEntity.ok(serverNodeService.getAllNodes());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ServerNodeResponse> getNode(@PathVariable UUID id) {
        return ResponseEntity.ok(serverNodeService.getNode(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
    public ResponseEntity<ServerNodeResponse> createNode(@Valid @RequestBody ServerNodeRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(serverNodeService.createNode(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
    public ResponseEntity<ServerNodeResponse> updateNode(@PathVariable UUID id,
                                                          @Valid @RequestBody ServerNodeRequest request) {
        return ResponseEntity.ok(serverNodeService.updateNode(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteNode(@PathVariable UUID id) {
        serverNodeService.deleteNode(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/refresh-metrics")
    public ResponseEntity<ServerNodeResponse> refreshMetrics(@PathVariable UUID id) {
        return ResponseEntity.ok(serverNodeService.refreshMetrics(id));
    }

    @PostMapping("/{id}/test-connection")
    @PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
    public ResponseEntity<Map<String, Boolean>> testConnection(@PathVariable UUID id) {
        boolean connected = serverNodeService.testConnection(id);
        return ResponseEntity.ok(Map.of("connected", connected));
    }
}
