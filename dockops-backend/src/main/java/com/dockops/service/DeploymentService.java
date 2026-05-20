package com.dockops.service;

import com.dockops.ai.GeminiService;
import com.dockops.dto.deployment.DeploymentRequest;
import com.dockops.dto.deployment.DeploymentResponse;
import com.dockops.entity.*;
import com.dockops.exception.DockOpsException;
import com.dockops.repository.DeploymentLogRepository;
import com.dockops.repository.DeploymentRepository;
import com.dockops.repository.UserRepository;
import com.dockops.ssh.SshCommandResult;
import com.dockops.ssh.SshConnectionManager;
import com.dockops.websocket.DeploymentEventBroadcaster;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeploymentService {

    private final DeploymentRepository deploymentRepository;
    private final DeploymentLogRepository deploymentLogRepository;
    private final ProjectService projectService;
    private final UserRepository userRepository;
    private final SshConnectionManager sshConnectionManager;
    private final DeploymentEventBroadcaster broadcaster;
    private final GeminiService geminiService;

    @Transactional(readOnly = true)
    public Page<DeploymentResponse> getDeployments(UUID projectId, int page, int size) {
        Project project = projectService.findById(projectId);
        return deploymentRepository.findByProjectOrderByCreatedAtDesc(
                project, PageRequest.of(page, size))
                .map(DeploymentResponse::from);
    }

    @Transactional(readOnly = true)
    public DeploymentResponse getDeployment(UUID id) {
        return DeploymentResponse.from(findById(id));
    }

    @Transactional
    public DeploymentResponse triggerDeployment(DeploymentRequest request) {
        Project project = projectService.findById(request.projectId());
        User currentUser = getCurrentUser();

        Deployment deployment = Deployment.builder()
                .project(project)
                .triggeredBy(currentUser)
                .triggerType(Deployment.TriggerType.MANUAL)
                .status(Deployment.DeploymentStatus.PENDING)
                .branch(request.branch() != null ? request.branch() : project.getBranch())
                .commitHash(request.commitHash())
                .build();

        Deployment saved = deploymentRepository.save(deployment);
        executeDeploymentAsync(saved.getId());
        return DeploymentResponse.from(saved);
    }

    @Transactional
    public DeploymentResponse triggerWebhookDeployment(Project project, String commitHash,
                                                        String commitMessage, String commitAuthor,
                                                        String branch) {
        Deployment deployment = Deployment.builder()
                .project(project)
                .triggerType(Deployment.TriggerType.WEBHOOK)
                .status(Deployment.DeploymentStatus.PENDING)
                .branch(branch)
                .commitHash(commitHash)
                .commitMessage(commitMessage)
                .commitAuthor(commitAuthor)
                .build();

        Deployment saved = deploymentRepository.save(deployment);
        executeDeploymentAsync(saved.getId());
        return DeploymentResponse.from(saved);
    }

    @Async
    public void executeDeploymentAsync(UUID deploymentId) {
        Deployment deployment = findById(deploymentId);
        Project project = deployment.getProject();
        ServerNode node = project.getServerNode();

        deployment.setStatus(Deployment.DeploymentStatus.RUNNING);
        deployment.setStartedAt(Instant.now());
        deploymentRepository.save(deployment);
        broadcaster.broadcastDeploymentStatus(deployment);

        StringBuilder failureLog = new StringBuilder();

        try {
            addLog(deployment, DeploymentLog.LogLevel.INFO, "Starting deployment for " + project.getName(), "system");
            broadcaster.broadcastLog(deployment.getId(), "INFO", "Starting deployment for " + project.getName());

            String workDir = project.getWorkingDirectory() != null
                    ? project.getWorkingDirectory()
                    : "/opt/dockops/" + project.getName().toLowerCase().replace(" ", "-");

            // Git operations
            addLog(deployment, DeploymentLog.LogLevel.INFO, "Pulling latest changes from " + deployment.getBranch(), "git");
            broadcaster.broadcastLog(deployment.getId(), "INFO", "Pulling latest changes...");

            String gitCmd = buildGitCommand(project, workDir, deployment.getBranch());
            SshCommandResult gitResult = sshConnectionManager.execute(node, gitCmd);

            if (!gitResult.success()) {
                failureLog.append("Git pull failed:\n").append(gitResult.stderr());
                throw new RuntimeException("Git pull failed: " + gitResult.stderr());
            }

            addLog(deployment, DeploymentLog.LogLevel.INFO, gitResult.stdout(), "git");
            broadcaster.broadcastLog(deployment.getId(), "INFO", gitResult.stdout());

            // Get current commit hash if not set
            if (deployment.getCommitHash() == null) {
                SshCommandResult hashResult = sshConnectionManager.execute(node,
                        "cd " + workDir + " && git rev-parse --short HEAD");
                if (hashResult.success()) {
                    deployment.setCommitHash(hashResult.stdout().trim());
                }
            }

            // Docker build + up
            String composePath = project.getComposeFilePath() != null
                    ? project.getComposeFilePath() : "docker-compose.yml";

            addLog(deployment, DeploymentLog.LogLevel.INFO, "Building Docker images...", "docker");
            broadcaster.broadcastLog(deployment.getId(), "INFO", "Building Docker images...");

            String buildCmd = String.format("cd %s && docker compose -f %s build 2>&1",
                    workDir, composePath);
            SshCommandResult buildResult = sshConnectionManager.execute(node, buildCmd);

            addLog(deployment, DeploymentLog.LogLevel.INFO, buildResult.output(), "docker");
            broadcaster.broadcastLog(deployment.getId(), "INFO", buildResult.output());

            if (!buildResult.success()) {
                failureLog.append("Docker build failed:\n").append(buildResult.output());
                throw new RuntimeException("Docker build failed: " + buildResult.output());
            }

            addLog(deployment, DeploymentLog.LogLevel.INFO, "Starting containers...", "docker");
            broadcaster.broadcastLog(deployment.getId(), "INFO", "Starting containers...");

            String upCmd = String.format("cd %s && docker compose -f %s up -d 2>&1",
                    workDir, composePath);
            SshCommandResult upResult = sshConnectionManager.execute(node, upCmd);

            addLog(deployment, DeploymentLog.LogLevel.INFO, upResult.output(), "docker");
            broadcaster.broadcastLog(deployment.getId(), "INFO", upResult.output());

            if (!upResult.success()) {
                failureLog.append("Docker compose up failed:\n").append(upResult.output());
                throw new RuntimeException("Docker compose up failed: " + upResult.output());
            }

            // Success
            deployment.setStatus(Deployment.DeploymentStatus.SUCCESS);
            deployment.setCompletedAt(Instant.now());
            deployment.setDurationMs(deployment.getCompletedAt().toEpochMilli() - deployment.getStartedAt().toEpochMilli());

            project.setLastDeployedCommit(deployment.getCommitHash());
            project.setLastDeployedAt(deployment.getCompletedAt());

            addLog(deployment, DeploymentLog.LogLevel.INFO,
                    "Deployment completed successfully in " + deployment.getDurationMs() + "ms", "system");
            broadcaster.broadcastLog(deployment.getId(), "INFO", "Deployment completed successfully!");

        } catch (Exception e) {
            log.error("Deployment failed for project {}: {}", project.getName(), e.getMessage());
            deployment.setStatus(Deployment.DeploymentStatus.FAILED);
            deployment.setCompletedAt(Instant.now());
            deployment.setDurationMs(deployment.getCompletedAt().toEpochMilli() - deployment.getStartedAt().toEpochMilli());
            deployment.setFailureReason(e.getMessage());

            addLog(deployment, DeploymentLog.LogLevel.ERROR, "Deployment failed: " + e.getMessage(), "system");
            broadcaster.broadcastLog(deployment.getId(), "ERROR", "Deployment failed: " + e.getMessage());

            // AI analysis
            try {
                String aiAnalysis = geminiService.analyzeDeploymentFailure(
                        failureLog.toString(), project.getName(),
                        deployment.getCommitHash() != null ? deployment.getCommitHash() : "unknown");
                deployment.setAiAnalysis(aiAnalysis);
                broadcaster.broadcastLog(deployment.getId(), "AI", "AI Analysis: " + aiAnalysis);
            } catch (Exception aiEx) {
                log.warn("AI analysis failed: {}", aiEx.getMessage());
            }
        } finally {
            deploymentRepository.save(deployment);
            broadcaster.broadcastDeploymentStatus(deployment);
        }
    }

    @Transactional
    public DeploymentResponse rollback(UUID deploymentId) {
        Deployment targetDeployment = findById(deploymentId);
        Project project = targetDeployment.getProject();

        if (targetDeployment.getStatus() != Deployment.DeploymentStatus.SUCCESS) {
            throw DockOpsException.badRequest("Can only rollback successful deployments");
        }

        User currentUser = getCurrentUser();
        Deployment rollback = Deployment.builder()
                .project(project)
                .triggeredBy(currentUser)
                .triggerType(Deployment.TriggerType.MANUAL)
                .status(Deployment.DeploymentStatus.PENDING)
                .branch(targetDeployment.getBranch())
                .commitHash(targetDeployment.getCommitHash())
                .previousCommitHash(project.getLastDeployedCommit())
                .build();

        Deployment saved = deploymentRepository.save(rollback);
        executeDeploymentAsync(saved.getId());
        return DeploymentResponse.from(saved);
    }

    private String buildGitCommand(Project project, String workDir, String branch) {
        return String.format(
                "if [ -d %s/.git ]; then cd %s && git fetch origin && git checkout %s && git pull origin %s; " +
                "else git clone -b %s %s %s; fi 2>&1",
                workDir, workDir, branch, branch, branch, project.getRepoUrl(), workDir
        );
    }

    private void addLog(Deployment deployment, DeploymentLog.LogLevel level, String message, String source) {
        if (message == null || message.isBlank()) return;
        DeploymentLog entry = DeploymentLog.builder()
                .deployment(deployment)
                .level(level)
                .message(message.length() > 5000 ? message.substring(0, 5000) : message)
                .source(source)
                .build();
        deploymentLogRepository.save(entry);
    }

    private Deployment findById(UUID id) {
        return deploymentRepository.findById(id)
                .orElseThrow(() -> DockOpsException.notFound("Deployment", id));
    }

    private User getCurrentUser() {
        try {
            String username = SecurityContextHolder.getContext().getAuthentication().getName();
            return userRepository.findByUsername(username).orElse(null);
        } catch (Exception e) {
            return null;
        }
    }
}
