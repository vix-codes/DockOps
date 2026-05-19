package com.dockops.websocket;

import com.dockops.dto.deployment.DeploymentResponse;
import com.dockops.entity.Deployment;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class DeploymentEventBroadcaster {

    private final SimpMessagingTemplate messagingTemplate;

    public void broadcastDeploymentStatus(Deployment deployment) {
        try {
            DeploymentResponse response = DeploymentResponse.from(deployment);
            messagingTemplate.convertAndSend(
                    "/topic/deployments/" + deployment.getProject().getId(),
                    response
            );
            messagingTemplate.convertAndSend("/topic/deployments/all", response);
        } catch (Exception e) {
            log.warn("Failed to broadcast deployment status: {}", e.getMessage());
        }
    }

    public void broadcastLog(UUID deploymentId, String level, String message) {
        try {
            LogEvent event = new LogEvent(deploymentId.toString(), level, message, Instant.now());
            messagingTemplate.convertAndSend("/topic/deployments/" + deploymentId + "/logs", event);
        } catch (Exception e) {
            log.warn("Failed to broadcast log: {}", e.getMessage());
        }
    }

    public record LogEvent(String deploymentId, String level, String message, Instant timestamp) {}
}
