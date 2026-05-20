package com.dockops.service;

import com.dockops.dto.container.ContainerResponse;
import com.dockops.dto.registry.ManagedAppRequest;
import com.dockops.dto.registry.ManagedAppResponse;
import com.dockops.entity.Deployment;
import com.dockops.entity.ManagedApp;
import com.dockops.entity.Project;
import com.dockops.entity.ServerNode;
import com.dockops.exception.DockOpsException;
import com.dockops.repository.DeploymentRepository;
import com.dockops.repository.ManagedAppRepository;
import com.dockops.repository.ProjectRepository;
import com.dockops.repository.ServerNodeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AppRegistryService {

    private final ManagedAppRepository appRepository;
    private final ServerNodeRepository nodeRepository;
    private final ContainerService containerService;
    private final ProjectRepository projectRepository;
    private final DeploymentRepository deploymentRepository;

    @Transactional(readOnly = true)
    public List<ManagedAppResponse> listApps() {
        return appRepository.findAllByOrderByDisplayNameAsc().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ManagedAppResponse getApp(UUID id) {
        ManagedApp app = findById(id);
        return toResponseWithRuntime(app);
    }

    @Transactional
    public ManagedAppResponse createApp(ManagedAppRequest request) {
        if (appRepository.existsByName(request.name())) {
            throw DockOpsException.badRequest("App with name '" + request.name() + "' already exists");
        }
        ManagedApp app = new ManagedApp();
        applyRequest(app, request);
        return toResponse(appRepository.save(app));
    }

    @Transactional
    public ManagedAppResponse updateApp(UUID id, ManagedAppRequest request) {
        ManagedApp app = findById(id);
        applyRequest(app, request);
        return toResponse(appRepository.save(app));
    }

    @Transactional
    public void deleteApp(UUID id) {
        appRepository.delete(findById(id));
    }

    private void applyRequest(ManagedApp app, ManagedAppRequest req) {
        app.setName(req.name());
        app.setDisplayName(req.displayName());
        app.setDescription(req.description());
        app.setContainerNames(req.containerNames() != null ? req.containerNames() : new ArrayList<>());
        app.setComposeFilePath(req.composeFilePath());
        app.setComposeWorkDir(req.composeWorkDir());
        app.setGitRepoUrl(req.gitRepoUrl());
        app.setGitBranch(req.gitBranch());
        app.setTags(req.tags() != null ? req.tags() : new ArrayList<>());
        app.setEnabled(req.enabled());
        if (req.serverNodeId() != null) {
            ServerNode node = nodeRepository.findById(req.serverNodeId())
                    .orElseThrow(() -> DockOpsException.notFound("Node", req.serverNodeId()));
            app.setServerNode(node);
        }
    }

    private ManagedAppResponse toResponse(ManagedApp app) {
        return buildResponse(app, null, 0, 0, null, null, null, null, null, null);
    }

    private ManagedAppResponse toResponseWithRuntime(ManagedApp app) {
        List<ContainerResponse> containers = new ArrayList<>();
        int running = 0;
        int total = 0;
        Double cpu = null;
        Double mem = null;
        String health = "unknown";

        if (app.getServerNode() != null && !app.getContainerNames().isEmpty()) {
            try {
                List<ContainerResponse> allContainers = containerService.listContainers(app.getServerNode().getId());
                Set<String> patterns = new HashSet<>(app.getContainerNames());
                containers = allContainers.stream()
                        .filter(c -> patterns.stream().anyMatch(p -> c.name().contains(p)))
                        .collect(Collectors.toList());
                total = containers.size();
                running = (int) containers.stream().filter(c -> "running".equals(c.state())).count();
                health = total == 0 ? "unknown"
                        : running == total ? "healthy"
                        : running > 0 ? "degraded"
                        : "down";
            } catch (Exception e) {
                log.warn("Could not fetch containers for app {}: {}", app.getName(), e.getMessage());
            }
        }

        // Find latest deployment from linked project
        String lastStatus = null;
        java.time.Instant lastDeployedAt = null;
        String lastCommit = null;
        try {
            List<Project> projects = projectRepository.findAll();
            Optional<Project> linked = projects.stream()
                    .filter(p -> p.getName().equalsIgnoreCase(app.getName()) ||
                            (app.getGitRepoUrl() != null && app.getGitRepoUrl().equals(p.getRepoUrl())))
                    .findFirst();
            if (linked.isPresent()) {
                Optional<Deployment> latest = deploymentRepository
                        .findTopByProjectOrderByCreatedAtDesc(linked.get());
                if (latest.isPresent()) {
                    lastStatus = latest.get().getStatus().name();
                    lastDeployedAt = latest.get().getCompletedAt();
                    lastCommit = latest.get().getCommitHash();
                }
            }
        } catch (Exception e) {
            log.debug("Could not fetch deployment for app {}: {}", app.getName(), e.getMessage());
        }

        return buildResponse(app, containers, running, total, health, cpu, mem, lastStatus, lastDeployedAt, lastCommit);
    }

    private ManagedAppResponse buildResponse(ManagedApp app,
                                              List<ContainerResponse> containers,
                                              int running, int total,
                                              String health,
                                              Double cpu, Double mem,
                                              String lastStatus,
                                              java.time.Instant lastDeployedAt,
                                              String lastCommit) {
        return new ManagedAppResponse(
                app.getId(),
                app.getName(),
                app.getDisplayName(),
                app.getDescription(),
                app.getServerNode() != null ? app.getServerNode().getId().toString() : null,
                app.getServerNode() != null ? app.getServerNode().getName() : null,
                app.getContainerNames(),
                app.getComposeFilePath(),
                app.getComposeWorkDir(),
                app.getGitRepoUrl(),
                app.getGitBranch(),
                app.getTags(),
                app.isEnabled(),
                app.getCreatedAt(),
                app.getUpdatedAt(),
                health,
                running,
                total,
                cpu,
                mem,
                containers,
                lastStatus,
                lastDeployedAt,
                lastCommit
        );
    }

    private ManagedApp findById(UUID id) {
        return appRepository.findById(id)
                .orElseThrow(() -> DockOpsException.notFound("App", id));
    }
}
