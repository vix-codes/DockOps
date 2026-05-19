package com.dockops.dto.container;

import java.time.Instant;

public record ContainerResponse(
        String containerId,
        String name,
        String image,
        String status,
        String state,
        String ports,
        String networkMode,
        Double cpuPercent,
        Long memoryUsageBytes,
        Long memoryLimitBytes,
        Instant startedAt,
        String serverNodeId,
        String serverNodeName
) {}
