package com.dockops.dto.deployment;

import com.dockops.entity.Deployment;

import java.time.Instant;
import java.util.UUID;

public record DeploymentResponse(
        UUID id,
        UUID projectId,
        String projectName,
        String triggeredBy,
        Deployment.TriggerType triggerType,
        Deployment.DeploymentStatus status,
        String commitHash,
        String commitMessage,
        String commitAuthor,
        String branch,
        Instant startedAt,
        Instant completedAt,
        Long durationMs,
        String failureReason,
        String aiAnalysis,
        Instant createdAt
) {
    public static DeploymentResponse from(Deployment d) {
        return new DeploymentResponse(
                d.getId(),
                d.getProject().getId(),
                d.getProject().getName(),
                d.getTriggeredBy() != null ? d.getTriggeredBy().getUsername() : "webhook",
                d.getTriggerType(),
                d.getStatus(),
                d.getCommitHash(),
                d.getCommitMessage(),
                d.getCommitAuthor(),
                d.getBranch(),
                d.getStartedAt(),
                d.getCompletedAt(),
                d.getDurationMs(),
                d.getFailureReason(),
                d.getAiAnalysis(),
                d.getCreatedAt()
        );
    }
}
