package com.dockops.dto.server;

import com.dockops.entity.ServerNode;

import java.time.Instant;
import java.util.UUID;

public record ServerNodeResponse(
        UUID id,
        String name,
        String host,
        int sshPort,
        String sshUser,
        ServerNode.AuthMethod authMethod,
        ServerNode.NodeStatus status,
        String description,
        String environment,
        String os,
        String kernelVersion,
        Double cpuUsage,
        Double ramUsage,
        Double diskUsage,
        Long uptimeSeconds,
        Integer runningContainers,
        Boolean dockerAvailable,
        Instant lastCheckedAt,
        Instant createdAt
) {
    public static ServerNodeResponse from(ServerNode node) {
        return new ServerNodeResponse(
                node.getId(), node.getName(), node.getHost(), node.getSshPort(),
                node.getSshUser(), node.getAuthMethod(), node.getStatus(),
                node.getDescription(), node.getEnvironment(), node.getOs(),
                node.getKernelVersion(), node.getCpuUsage(), node.getRamUsage(),
                node.getDiskUsage(), node.getUptimeSeconds(), node.getRunningContainers(),
                node.getDockerAvailable(), node.getLastCheckedAt(), node.getCreatedAt()
        );
    }
}
