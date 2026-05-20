package com.dockops.dto.registry;

import jakarta.validation.constraints.NotBlank;

import java.util.List;
import java.util.UUID;

public record ManagedAppRequest(
        @NotBlank String name,
        @NotBlank String displayName,
        String description,
        UUID serverNodeId,
        List<String> containerNames,
        String composeFilePath,
        String composeWorkDir,
        String gitRepoUrl,
        String gitBranch,
        List<String> tags,
        boolean enabled
) {}
