package com.dockops.dto.docker;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ContainerStatsResponse(
        String containerId,
        String name,
        String cpuPercent,
        String memUsage,
        String memPercent,
        String netIO,
        String blockIO,
        int pids
) {}
