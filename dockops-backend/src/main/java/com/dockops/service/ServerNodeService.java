package com.dockops.service;

import com.dockops.dto.server.ServerNodeRequest;
import com.dockops.dto.server.ServerNodeResponse;
import com.dockops.entity.ServerNode;
import com.dockops.exception.DockOpsException;
import com.dockops.repository.ServerNodeRepository;
import com.dockops.ssh.SshConnectionManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ServerNodeService {

    private final ServerNodeRepository serverNodeRepository;
    private final SshConnectionManager sshConnectionManager;
    private final MetricsService metricsService;

    @Transactional(readOnly = true)
    public List<ServerNodeResponse> getAllNodes() {
        return serverNodeRepository.findAll().stream()
                .map(ServerNodeResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public ServerNodeResponse getNode(UUID id) {
        return ServerNodeResponse.from(findById(id));
    }

    @Transactional
    public ServerNodeResponse createNode(ServerNodeRequest request) {
        if (serverNodeRepository.existsByName(request.name())) {
            throw DockOpsException.conflict("Server node already exists: " + request.name());
        }

        ServerNode node = ServerNode.builder()
                .name(request.name())
                .host(request.host())
                .sshPort(request.sshPort())
                .sshUser(request.sshUser())
                .sshPassword(request.sshPassword())
                .sshPrivateKey(request.sshPrivateKey())
                .sshPrivateKeyPassphrase(request.sshPrivateKeyPassphrase())
                .authMethod(request.authMethod())
                .description(request.description())
                .environment(request.environment())
                .status(ServerNode.NodeStatus.UNKNOWN)
                .build();

        boolean connected = sshConnectionManager.testConnection(node);
        node.setStatus(connected ? ServerNode.NodeStatus.ONLINE : ServerNode.NodeStatus.OFFLINE);

        ServerNode saved = serverNodeRepository.save(node);
        log.info("Server node registered: {} ({})", saved.getName(), saved.getHost());

        if (connected) {
            try {
                metricsService.collectMetrics(saved);
            } catch (Exception e) {
                log.warn("Initial metrics collection failed for {}: {}", saved.getName(), e.getMessage());
            }
        }

        return ServerNodeResponse.from(saved);
    }

    @Transactional
    public ServerNodeResponse updateNode(UUID id, ServerNodeRequest request) {
        ServerNode node = findById(id);

        node.setName(request.name());
        node.setHost(request.host());
        node.setSshPort(request.sshPort());
        node.setSshUser(request.sshUser());
        node.setAuthMethod(request.authMethod());
        node.setDescription(request.description());
        node.setEnvironment(request.environment());

        if (request.sshPassword() != null) node.setSshPassword(request.sshPassword());
        if (request.sshPrivateKey() != null) node.setSshPrivateKey(request.sshPrivateKey());
        if (request.sshPrivateKeyPassphrase() != null) node.setSshPrivateKeyPassphrase(request.sshPrivateKeyPassphrase());

        sshConnectionManager.invalidateSession(id);
        return ServerNodeResponse.from(serverNodeRepository.save(node));
    }

    @Transactional
    public void deleteNode(UUID id) {
        ServerNode node = findById(id);
        sshConnectionManager.invalidateSession(id);
        serverNodeRepository.delete(node);
        log.info("Server node deleted: {}", node.getName());
    }

    @Transactional
    public ServerNodeResponse refreshMetrics(UUID id) {
        ServerNode node = findById(id);
        ServerNode updated = metricsService.collectMetrics(node);
        return ServerNodeResponse.from(updated);
    }

    @Transactional
    public boolean testConnection(UUID id) {
        ServerNode node = findById(id);
        boolean connected = sshConnectionManager.testConnection(node);
        node.setStatus(connected ? ServerNode.NodeStatus.ONLINE : ServerNode.NodeStatus.OFFLINE);
        serverNodeRepository.save(node);
        return connected;
    }

    public ServerNode findById(UUID id) {
        return serverNodeRepository.findById(id)
                .orElseThrow(() -> DockOpsException.notFound("ServerNode", id));
    }
}
