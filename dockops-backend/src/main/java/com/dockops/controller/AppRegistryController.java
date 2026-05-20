package com.dockops.controller;

import com.dockops.dto.registry.ManagedAppRequest;
import com.dockops.dto.registry.ManagedAppResponse;
import com.dockops.service.AppRegistryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/apps")
@RequiredArgsConstructor
public class AppRegistryController {

    private final AppRegistryService appRegistryService;

    @GetMapping
    public ResponseEntity<List<ManagedAppResponse>> list() {
        return ResponseEntity.ok(appRegistryService.listApps());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ManagedAppResponse> get(@PathVariable UUID id) {
        return ResponseEntity.ok(appRegistryService.getApp(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
    public ResponseEntity<ManagedAppResponse> create(@Valid @RequestBody ManagedAppRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(appRegistryService.createApp(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
    public ResponseEntity<ManagedAppResponse> update(@PathVariable UUID id,
                                                      @Valid @RequestBody ManagedAppRequest request) {
        return ResponseEntity.ok(appRegistryService.updateApp(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        appRegistryService.deleteApp(id);
        return ResponseEntity.noContent().build();
    }
}
