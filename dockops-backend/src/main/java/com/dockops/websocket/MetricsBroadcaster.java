package com.dockops.websocket;

import com.dockops.dto.server.ServerNodeResponse;
import com.dockops.entity.ServerNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
@RequiredArgsConstructor
@Slf4j
public class MetricsBroadcaster {

    private final SimpMessagingTemplate messagingTemplate;

    public void broadcastMetrics(ServerNode node) {
        try {
            ServerNodeResponse response = ServerNodeResponse.from(node);
            messagingTemplate.convertAndSend("/topic/nodes/" + node.getId() + "/metrics", response);
            messagingTemplate.convertAndSend("/topic/nodes/metrics", response);
        } catch (Exception e) {
            log.warn("Failed to broadcast metrics for node {}: {}", node.getName(), e.getMessage());
        }
    }

    public record MetricSnapshot(
            String nodeId,
            String nodeName,
            Double cpuUsage,
            Double ramUsage,
            Double diskUsage,
            Long uptimeSeconds,
            Integer runningContainers,
            Boolean dockerAvailable,
            String status,
            Instant timestamp
    ) {}
}
