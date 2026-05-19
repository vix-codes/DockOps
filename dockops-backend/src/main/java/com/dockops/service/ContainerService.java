package com.dockops.service;

import com.dockops.dto.container.ContainerResponse;
import com.dockops.entity.ContainerInstance;
import com.dockops.entity.ServerNode;
import com.dockops.exception.DockOpsException;
import com.dockops.repository.ContainerInstanceRepository;
import com.dockops.ssh.SshCommandResult;
import com.dockops.ssh.SshConnectionManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContainerService {

    private final SshConnectionManager sshConnectionManager;
    private final ContainerInstanceRepository containerRepository;
    private final ServerNodeService serverNodeService;

    private static final String LIST_CMD =
            "docker ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.State}}|{{.Ports}}'";
    private static final String STATS_CMD =
            "docker stats --no-stream --format '{{.ID}}|{{.CPUPerc}}|{{.MemUsage}}'";

    @Transactional
    public List<ContainerResponse> listContainers(UUID nodeId) {
        ServerNode node = serverNodeService.findById(nodeId);
        SshCommandResult result = sshConnectionManager.execute(node, LIST_CMD);

        if (!result.success() && !result.stdout().isBlank()) {
            throw DockOpsException.sshError("Failed to list containers: " + result.stderr());
        }

        List<ContainerResponse> containers = new ArrayList<>();
        if (result.stdout().isBlank()) return containers;

        for (String line : result.stdout().split("\n")) {
            String[] parts = line.split("\\|", -1);
            if (parts.length < 5) continue;
            String containerId = parts[0].trim();
            String name = parts[1].trim();
            String image = parts[2].trim();
            String status = parts[3].trim();
            String state = parts[4].trim();
            String ports = parts.length > 5 ? parts[5].trim() : "";

            containers.add(new ContainerResponse(
                    containerId, name, image, status, state, ports,
                    null, null, null, null, null,
                    nodeId.toString(), node.getName()
            ));
        }

        return containers;
    }

    @Transactional
    public void executeAction(UUID nodeId, String containerId, String action) {
        ServerNode node = serverNodeService.findById(nodeId);
        String command = buildDockerCommand(action, containerId);

        SshCommandResult result = sshConnectionManager.execute(node, command);
        if (!result.success()) {
            throw DockOpsException.badRequest(
                    "Container action '" + action + "' failed: " + result.stderr());
        }
        log.info("Container action '{}' executed on {} for container {}", action, node.getName(), containerId);
    }

    public List<String> streamLogs(UUID nodeId, String containerId, int tail) {
        ServerNode node = serverNodeService.findById(nodeId);
        String command = String.format("docker logs --tail %d %s 2>&1", tail, containerId);
        SshCommandResult result = sshConnectionManager.execute(node, command);
        return List.of(result.output().split("\n"));
    }

    private String buildDockerCommand(String action, String containerId) {
        return switch (action.toLowerCase()) {
            case "start"   -> "docker start " + containerId;
            case "stop"    -> "docker stop " + containerId;
            case "restart" -> "docker restart " + containerId;
            case "remove"  -> "docker rm -f " + containerId;
            case "pause"   -> "docker pause " + containerId;
            case "unpause" -> "docker unpause " + containerId;
            default -> throw DockOpsException.badRequest("Unknown container action: " + action);
        };
    }
}
