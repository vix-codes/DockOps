package com.dockops.controller;

import com.dockops.dto.docker.*;
import com.dockops.service.DockerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/nodes/{nodeId}/docker")
@RequiredArgsConstructor
public class DockerController {

    private final DockerService dockerService;

    // Images
    @GetMapping("/images")
    public ResponseEntity<List<DockerImageResponse>> listImages(@PathVariable UUID nodeId) {
        return ResponseEntity.ok(dockerService.listImages(nodeId));
    }

    @DeleteMapping("/images/{imageId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
    public ResponseEntity<Void> removeImage(@PathVariable UUID nodeId,
                                             @PathVariable String imageId) {
        dockerService.removeImage(nodeId, imageId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/images/pull")
    @PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
    public ResponseEntity<Void> pullImage(@PathVariable UUID nodeId,
                                           @RequestBody Map<String, String> body) {
        dockerService.pullImage(nodeId, body.get("image"));
        return ResponseEntity.ok().build();
    }

    // Volumes
    @GetMapping("/volumes")
    public ResponseEntity<List<DockerVolumeResponse>> listVolumes(@PathVariable UUID nodeId) {
        return ResponseEntity.ok(dockerService.listVolumes(nodeId));
    }

    @DeleteMapping("/volumes/{volumeName}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
    public ResponseEntity<Void> removeVolume(@PathVariable UUID nodeId,
                                              @PathVariable String volumeName) {
        dockerService.removeVolume(nodeId, volumeName);
        return ResponseEntity.ok().build();
    }

    // Networks
    @GetMapping("/networks")
    public ResponseEntity<List<DockerNetworkResponse>> listNetworks(@PathVariable UUID nodeId) {
        return ResponseEntity.ok(dockerService.listNetworks(nodeId));
    }

    // Stats
    @GetMapping("/stats")
    public ResponseEntity<List<ContainerStatsResponse>> getStats(@PathVariable UUID nodeId) {
        return ResponseEntity.ok(dockerService.getContainerStats(nodeId));
    }

    // System prune
    @PostMapping("/prune")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> pruneSystem(@PathVariable UUID nodeId,
                                                            @RequestParam(defaultValue = "false") boolean volumes) {
        String output = dockerService.pruneSystem(nodeId, volumes);
        return ResponseEntity.ok(Map.of("output", output));
    }
}
