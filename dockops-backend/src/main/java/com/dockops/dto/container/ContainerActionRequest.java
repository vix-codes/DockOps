package com.dockops.dto.container;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record ContainerActionRequest(
        @NotNull UUID serverNodeId,
        @NotBlank String containerId,
        @NotBlank String action
) {}
