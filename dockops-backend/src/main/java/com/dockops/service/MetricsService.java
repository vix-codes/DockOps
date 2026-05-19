package com.dockops.service;

import com.dockops.entity.ServerNode;
import com.dockops.repository.ServerNodeRepository;
import com.dockops.ssh.SshCommandResult;
import com.dockops.ssh.SshConnectionManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class MetricsService {

    private final SshConnectionManager sshConnectionManager;
    private final ServerNodeRepository serverNodeRepository;

    private static final String CPU_CMD =
            "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | sed 's/%us,//'";
    private static final String RAM_CMD =
            "free | grep Mem | awk '{printf \"%.1f\", $3/$2 * 100}'";
    private static final String DISK_CMD =
            "df -h / | awk 'NR==2{print $5}' | sed 's/%//'";
    private static final String UPTIME_CMD =
            "cat /proc/uptime | awk '{print int($1)}'";
    private static final String DOCKER_CMD =
            "docker ps -q 2>/dev/null | wc -l";
    private static final String DOCKER_CHECK_CMD =
            "which docker && docker info --format '{{.ServerVersion}}' 2>/dev/null && echo 'available' || echo 'unavailable'";
    private static final String OS_CMD =
            "cat /etc/os-release | grep PRETTY_NAME | cut -d'=' -f2 | tr -d '\"'";
    private static final String KERNEL_CMD =
            "uname -r";

    @Transactional
    public ServerNode collectMetrics(ServerNode node) {
        try {
            Double cpu = parseDouble(exec(node, CPU_CMD));
            Double ram = parseDouble(exec(node, RAM_CMD));
            Double disk = parseDouble(exec(node, DISK_CMD));
            Long uptime = parseLong(exec(node, UPTIME_CMD));
            boolean dockerAvailable = checkDocker(node);
            Integer containers = dockerAvailable ? parseInt(exec(node, DOCKER_CMD)) : 0;

            if (node.getOs() == null) {
                node.setOs(exec(node, OS_CMD));
                node.setKernelVersion(exec(node, KERNEL_CMD));
            }

            node.setCpuUsage(cpu);
            node.setRamUsage(ram);
            node.setDiskUsage(disk);
            node.setUptimeSeconds(uptime);
            node.setDockerAvailable(dockerAvailable);
            node.setRunningContainers(containers);
            node.setStatus(ServerNode.NodeStatus.ONLINE);
            node.setLastCheckedAt(Instant.now());

            return serverNodeRepository.save(node);
        } catch (Exception e) {
            log.error("Failed to collect metrics for node {}: {}", node.getName(), e.getMessage());
            node.setStatus(ServerNode.NodeStatus.ERROR);
            node.setLastCheckedAt(Instant.now());
            return serverNodeRepository.save(node);
        }
    }

    private String exec(ServerNode node, String cmd) {
        SshCommandResult result = sshConnectionManager.execute(node, cmd);
        return result.stdout();
    }

    private boolean checkDocker(ServerNode node) {
        try {
            SshCommandResult result = sshConnectionManager.execute(node, DOCKER_CHECK_CMD);
            return result.success() && result.stdout().contains("available");
        } catch (Exception e) {
            return false;
        }
    }

    private Double parseDouble(String value) {
        try {
            if (value == null || value.isBlank()) return 0.0;
            String cleaned = value.replaceAll("[^0-9.]", "").trim();
            return cleaned.isEmpty() ? 0.0 : Double.parseDouble(cleaned);
        } catch (NumberFormatException e) {
            return 0.0;
        }
    }

    private Long parseLong(String value) {
        try {
            if (value == null || value.isBlank()) return 0L;
            String cleaned = value.replaceAll("[^0-9]", "").trim();
            return cleaned.isEmpty() ? 0L : Long.parseLong(cleaned);
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    private Integer parseInt(String value) {
        try {
            if (value == null || value.isBlank()) return 0;
            String cleaned = value.trim().replaceAll("[^0-9]", "");
            return cleaned.isEmpty() ? 0 : Integer.parseInt(cleaned);
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
