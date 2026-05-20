package com.dockops.service;

import com.dockops.dto.docker.*;
import com.dockops.entity.ServerNode;
import com.dockops.exception.DockOpsException;
import com.dockops.ssh.SshCommandResult;
import com.dockops.ssh.SshConnectionManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class DockerService {

    private final SshConnectionManager sshManager;
    private final ServerNodeService serverNodeService;

    // Images
    public List<DockerImageResponse> listImages(UUID nodeId) {
        ServerNode node = serverNodeService.findById(nodeId);
        // Format: ID|RepoTags|Size|CreatedSince
        String cmd = "docker images --format '{{.ID}}|{{.Repository}}|{{.Tag}}|{{.Size}}|{{.CreatedSince}}'";
        SshCommandResult result = sshManager.execute(node, cmd);
        List<DockerImageResponse> images = new ArrayList<>();
        if (result.stdout().isBlank()) return images;
        for (String line : result.stdout().split("\n")) {
            String[] p = line.split("\\|", -1);
            if (p.length < 5) continue;
            String id = p[0].trim();
            images.add(new DockerImageResponse(
                    id, id.length() > 12 ? id.substring(0, 12) : id,
                    p[1].trim(), p[2].trim(),
                    0L, p[4].trim()
            ));
        }
        return images;
    }

    public void removeImage(UUID nodeId, String imageId) {
        ServerNode node = serverNodeService.findById(nodeId);
        SshCommandResult result = sshManager.execute(node, "docker rmi " + imageId);
        if (!result.success()) {
            throw DockOpsException.badRequest("Image removal failed: " + result.stderr());
        }
    }

    public void pullImage(UUID nodeId, String imageName) {
        ServerNode node = serverNodeService.findById(nodeId);
        SshCommandResult result = sshManager.execute(node, "docker pull " + imageName);
        if (!result.success()) {
            throw DockOpsException.badRequest("Image pull failed: " + result.stderr());
        }
    }

    // Volumes
    public List<DockerVolumeResponse> listVolumes(UUID nodeId) {
        ServerNode node = serverNodeService.findById(nodeId);
        String cmd = "docker volume ls --format '{{.Name}}|{{.Driver}}|{{.Scope}}'";
        SshCommandResult result = sshManager.execute(node, cmd);
        List<DockerVolumeResponse> volumes = new ArrayList<>();
        if (result.stdout().isBlank()) return volumes;
        for (String line : result.stdout().split("\n")) {
            String[] p = line.split("\\|", -1);
            if (p.length < 3) continue;
            String name = p[0].trim();
            // Get mountpoint separately
            String mountpoint = "";
            SshCommandResult inspect = sshManager.execute(node,
                    "docker volume inspect --format '{{.Mountpoint}}' " + name);
            if (inspect.success()) mountpoint = inspect.stdout().trim();
            volumes.add(new DockerVolumeResponse(name, p[1].trim(), mountpoint, "", p[2].trim()));
        }
        return volumes;
    }

    public void removeVolume(UUID nodeId, String volumeName) {
        ServerNode node = serverNodeService.findById(nodeId);
        SshCommandResult result = sshManager.execute(node, "docker volume rm " + volumeName);
        if (!result.success()) {
            throw DockOpsException.badRequest("Volume removal failed: " + result.stderr());
        }
    }

    // Networks
    public List<DockerNetworkResponse> listNetworks(UUID nodeId) {
        ServerNode node = serverNodeService.findById(nodeId);
        String cmd = "docker network ls --format '{{.ID}}|{{.Name}}|{{.Driver}}|{{.Scope}}'";
        SshCommandResult result = sshManager.execute(node, cmd);
        List<DockerNetworkResponse> networks = new ArrayList<>();
        if (result.stdout().isBlank()) return networks;
        for (String line : result.stdout().split("\n")) {
            String[] p = line.split("\\|", -1);
            if (p.length < 4) continue;
            String id = p[0].trim();
            String name = p[1].trim();
            // Inspect for subnet/gateway/internal/containers
            String subnet = "", gateway = "";
            boolean internal = false;
            int containerCount = 0;
            try {
                SshCommandResult inspect = sshManager.execute(node,
                        "docker network inspect " + id +
                        " --format '{{range .IPAM.Config}}{{.Subnet}}|{{.Gateway}}{{end}}|{{.Internal}}|{{len .Containers}}'");
                if (inspect.success() && !inspect.stdout().isBlank()) {
                    String[] ip = inspect.stdout().split("\\|", -1);
                    if (ip.length >= 1) subnet = ip[0].trim();
                    if (ip.length >= 2) gateway = ip[1].trim();
                    if (ip.length >= 3) internal = Boolean.parseBoolean(ip[2].trim());
                    if (ip.length >= 4) {
                        try { containerCount = Integer.parseInt(ip[3].trim()); } catch (NumberFormatException ignored) {}
                    }
                }
            } catch (Exception ignored) {}
            networks.add(new DockerNetworkResponse(
                    id, id.length() > 12 ? id.substring(0, 12) : id,
                    name, p[2].trim(), p[3].trim(),
                    subnet, gateway, internal, containerCount
            ));
        }
        return networks;
    }

    // Stats
    public List<ContainerStatsResponse> getContainerStats(UUID nodeId) {
        ServerNode node = serverNodeService.findById(nodeId);
        String cmd = "docker stats --no-stream --format '{{.ID}}|{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.NetIO}}|{{.BlockIO}}|{{.PIDs}}'";
        SshCommandResult result = sshManager.execute(node, cmd);
        List<ContainerStatsResponse> stats = new ArrayList<>();
        if (result.stdout().isBlank()) return stats;
        for (String line : result.stdout().split("\n")) {
            String[] p = line.split("\\|", -1);
            if (p.length < 8) continue;
            int pids = 0;
            try { pids = Integer.parseInt(p[7].trim()); } catch (NumberFormatException ignored) {}
            stats.add(new ContainerStatsResponse(
                    p[0].trim(), p[1].trim(),
                    p[2].trim(), p[3].trim(), p[4].trim(),
                    p[5].trim(), p[6].trim(), pids
            ));
        }
        return stats;
    }

    // System prune
    public String pruneSystem(UUID nodeId, boolean volumes) {
        ServerNode node = serverNodeService.findById(nodeId);
        String cmd = volumes ? "docker system prune -af --volumes" : "docker system prune -af";
        SshCommandResult result = sshManager.execute(node, cmd);
        return result.success() ? result.stdout() : result.stderr();
    }
}
