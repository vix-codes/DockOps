package com.dockops.webhook;

import com.dockops.dto.deployment.DeploymentResponse;
import com.dockops.entity.Project;
import com.dockops.repository.ProjectRepository;
import com.dockops.service.DeploymentService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Map;

@RestController
@RequestMapping("/api/webhooks")
@RequiredArgsConstructor
@Slf4j
public class WebhookController {

    private final ProjectRepository projectRepository;
    private final DeploymentService deploymentService;
    private final ObjectMapper objectMapper;

    @PostMapping("/github/{projectId}")
    public ResponseEntity<Map<String, String>> handleGitHubWebhook(
            @PathVariable String projectId,
            @RequestHeader(value = "X-Hub-Signature-256", required = false) String signature,
            @RequestHeader(value = "X-GitHub-Event", defaultValue = "push") String event,
            @RequestBody String payload) {

        Project project = projectRepository.findById(java.util.UUID.fromString(projectId))
                .orElse(null);

        if (project == null) {
            return ResponseEntity.notFound().build();
        }

        if (project.getWebhookSecret() != null && signature != null) {
            if (!verifySignature(payload, signature, project.getWebhookSecret())) {
                log.warn("Invalid webhook signature for project {}", projectId);
                return ResponseEntity.status(401).body(Map.of("error", "Invalid signature"));
            }
        }

        if (!"push".equals(event)) {
            return ResponseEntity.ok(Map.of("status", "ignored", "event", event));
        }

        try {
            JsonNode root = objectMapper.readTree(payload);
            String ref = root.path("ref").asText("");
            String branch = ref.replace("refs/heads/", "");

            if (!branch.equals(project.getBranch())) {
                log.info("Webhook for project {} ignored — branch {} != {}", project.getName(), branch, project.getBranch());
                return ResponseEntity.ok(Map.of("status", "ignored", "reason", "branch mismatch"));
            }

            JsonNode headCommit = root.path("head_commit");
            String commitHash = headCommit.path("id").asText();
            String commitMessage = headCommit.path("message").asText();
            String commitAuthor = headCommit.path("author").path("name").asText();

            DeploymentResponse deployment = deploymentService.triggerWebhookDeployment(
                    project, commitHash, commitMessage, commitAuthor, branch);

            log.info("Webhook deployment triggered for project {} — commit {}", project.getName(), commitHash);
            return ResponseEntity.ok(Map.of(
                    "status", "deployment_triggered",
                    "deploymentId", deployment.id().toString()
            ));

        } catch (Exception e) {
            log.error("Webhook processing failed: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    private boolean verifySignature(String payload, String signature, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String expected = "sha256=" + HexFormat.of().formatHex(hash);
            return expected.equals(signature);
        } catch (Exception e) {
            return false;
        }
    }
}
