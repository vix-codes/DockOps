package com.dockops.dto.docker;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record DockerImageResponse(
        String id,
        String shortId,
        String repository,
        String tag,
        long size,
        String created
) {}
