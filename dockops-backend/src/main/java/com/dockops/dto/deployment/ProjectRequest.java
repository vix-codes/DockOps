package com.dockops.dto.deployment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record ProjectRequest(
        @NotBlank @Size(min = 1, max = 100) String name,
        String description,
        @NotBlank String repoUrl,
        @NotBlank String branch,
        String composeFilePath,
        String workingDirectory,
        @NotNull UUID serverNodeId
) {}
