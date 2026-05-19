package com.dockops.controller;

import com.dockops.dto.deployment.DeploymentRequest;
import com.dockops.dto.deployment.DeploymentResponse;
import com.dockops.service.DeploymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/deployments")
@RequiredArgsConstructor
public class DeploymentController {

    private final DeploymentService deploymentService;

    @GetMapping
    public ResponseEntity<Page<DeploymentResponse>> getDeployments(
            @RequestParam UUID projectId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(deploymentService.getDeployments(projectId, page, size));
    }

    @GetMapping("/{id}")
    public ResponseEntity<DeploymentResponse> getDeployment(@PathVariable UUID id) {
        return ResponseEntity.ok(deploymentService.getDeployment(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
    public ResponseEntity<DeploymentResponse> triggerDeployment(@Valid @RequestBody DeploymentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(deploymentService.triggerDeployment(request));
    }

    @PostMapping("/{id}/rollback")
    @PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
    public ResponseEntity<DeploymentResponse> rollback(@PathVariable UUID id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(deploymentService.rollback(id));
    }
}
