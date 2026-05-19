package com.dockops.controller;

import com.dockops.dto.container.ContainerActionRequest;
import com.dockops.dto.container.ContainerResponse;
import com.dockops.service.ContainerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/containers")
@RequiredArgsConstructor
public class ContainerController {

    private final ContainerService containerService;

    @GetMapping
    public ResponseEntity<List<ContainerResponse>> listContainers(@RequestParam UUID nodeId) {
        return ResponseEntity.ok(containerService.listContainers(nodeId));
    }

    @PostMapping("/action")
    @PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
    public ResponseEntity<Void> executeAction(@Valid @RequestBody ContainerActionRequest request) {
        containerService.executeAction(request.serverNodeId(), request.containerId(), request.action());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/logs")
    public ResponseEntity<List<String>> getLogs(@RequestParam UUID nodeId,
                                                  @RequestParam String containerId,
                                                  @RequestParam(defaultValue = "100") int tail) {
        return ResponseEntity.ok(containerService.streamLogs(nodeId, containerId, tail));
    }
}
