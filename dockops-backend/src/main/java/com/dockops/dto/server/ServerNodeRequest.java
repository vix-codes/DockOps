package com.dockops.dto.server;

import com.dockops.entity.ServerNode;
import jakarta.validation.constraints.*;

public record ServerNodeRequest(
        @NotBlank @Size(min = 1, max = 100) String name,
        @NotBlank String host,
        @Min(1) @Max(65535) int sshPort,
        @NotBlank String sshUser,
        String sshPassword,
        String sshPrivateKey,
        String sshPrivateKeyPassphrase,
        @NotNull ServerNode.AuthMethod authMethod,
        String description,
        String environment
) {}
