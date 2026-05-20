package com.dockops.dto.docker;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record DockerVolumeResponse(
        String name,
        String driver,
        String mountpoint,
        String created,
        String scope
) {}
