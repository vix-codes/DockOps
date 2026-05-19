package com.dockops.dto.deployment;

import com.dockops.entity.Project;

import java.time.Instant;
import java.util.UUID;

public record ProjectResponse(
        UUID id,
        String name,
        String description,
        String repoUrl,
        String branch,
        String composeFilePath,
        String workingDirectory,
        UUID serverNodeId,
        String serverNodeName,
        Project.ProjectStatus status,
        String lastDeployedCommit,
        Instant lastDeployedAt,
        Instant createdAt
) {
    public static ProjectResponse from(Project p) {
        return new ProjectResponse(
                p.getId(), p.getName(), p.getDescription(), p.getRepoUrl(),
                p.getBranch(), p.getComposeFilePath(), p.getWorkingDirectory(),
                p.getServerNode().getId(), p.getServerNode().getName(),
                p.getStatus(), p.getLastDeployedCommit(), p.getLastDeployedAt(),
                p.getCreatedAt()
        );
    }
}
