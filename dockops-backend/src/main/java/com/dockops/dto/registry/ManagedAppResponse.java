package com.dockops.dto.registry;

import com.dockops.dto.container.ContainerResponse;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ManagedAppResponse(
        UUID id,
        String name,
        String displayName,
        String description,
        String serverNodeId,
        String serverNodeName,
        List<String> containerNames,
        String composeFilePath,
        String composeWorkDir,
        String gitRepoUrl,
        String gitBranch,
        List<String> tags,
        boolean enabled,
        Instant createdAt,
        Instant updatedAt,

        // Runtime state (populated on demand)
        String healthStatus,       // "healthy" | "degraded" | "down" | "unknown"
        int runningContainers,
        int totalContainers,
        Double cpuPercent,
        Double memoryPercent,
        List<ContainerResponse> containers,
        String lastDeploymentStatus,
        Instant lastDeployedAt,
        String lastDeployedCommit
) {}
