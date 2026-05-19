package com.dockops.dto.deployment;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record DeploymentRequest(
        @NotNull UUID projectId,
        String branch,
        String commitHash
) {}
