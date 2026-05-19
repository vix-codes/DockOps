package com.dockops.service;

import com.dockops.dto.deployment.ProjectRequest;
import com.dockops.dto.deployment.ProjectResponse;
import com.dockops.entity.Project;
import com.dockops.entity.ServerNode;
import com.dockops.entity.User;
import com.dockops.exception.DockOpsException;
import com.dockops.repository.ProjectRepository;
import com.dockops.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final ServerNodeService serverNodeService;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<ProjectResponse> getAllProjects() {
        return projectRepository.findAll().stream()
                .map(ProjectResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectResponse getProject(UUID id) {
        return ProjectResponse.from(findById(id));
    }

    @Transactional
    public ProjectResponse createProject(ProjectRequest request) {
        if (projectRepository.existsByName(request.name())) {
            throw DockOpsException.conflict("Project already exists: " + request.name());
        }

        ServerNode node = serverNodeService.findById(request.serverNodeId());
        User currentUser = getCurrentUser();

        String webhookSecret = UUID.randomUUID().toString().replace("-", "");

        Project project = Project.builder()
                .name(request.name())
                .description(request.description())
                .repoUrl(request.repoUrl())
                .branch(request.branch() != null ? request.branch() : "main")
                .composeFilePath(request.composeFilePath() != null ? request.composeFilePath() : "docker-compose.yml")
                .workingDirectory(request.workingDirectory())
                .serverNode(node)
                .createdBy(currentUser)
                .webhookSecret(webhookSecret)
                .build();

        Project saved = projectRepository.save(project);
        log.info("Project created: {} on node {}", saved.getName(), node.getName());
        return ProjectResponse.from(saved);
    }

    @Transactional
    public ProjectResponse updateProject(UUID id, ProjectRequest request) {
        Project project = findById(id);
        ServerNode node = serverNodeService.findById(request.serverNodeId());

        project.setName(request.name());
        project.setDescription(request.description());
        project.setRepoUrl(request.repoUrl());
        project.setBranch(request.branch());
        project.setComposeFilePath(request.composeFilePath());
        project.setWorkingDirectory(request.workingDirectory());
        project.setServerNode(node);

        return ProjectResponse.from(projectRepository.save(project));
    }

    @Transactional
    public void deleteProject(UUID id) {
        Project project = findById(id);
        projectRepository.delete(project);
        log.info("Project deleted: {}", project.getName());
    }

    public Project findById(UUID id) {
        return projectRepository.findById(id)
                .orElseThrow(() -> DockOpsException.notFound("Project", id));
    }

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsername(username).orElse(null);
    }
}
