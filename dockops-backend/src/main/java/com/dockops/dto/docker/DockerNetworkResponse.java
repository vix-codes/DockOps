package com.dockops.dto.docker;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record DockerNetworkResponse(
        String id,
        String shortId,
        String name,
        String driver,
        String scope,
        String subnet,
        String gateway,
        boolean internal,
        int containers
) {}
