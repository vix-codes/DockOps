package com.dockops.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
public class EvalForgeNotifier {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Value("${app.evalforge.api-url:}")
    private String evalForgeApiUrl;

    @Value("${app.evalforge.webhook-secret:}")
    private String webhookSecret;

    @Value("${app.evalforge.enabled:false}")
    private boolean enabled;

    public EvalForgeNotifier(WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.webClient = webClientBuilder.build();
        this.objectMapper = objectMapper;
    }

    public void notifyDeployment(UUID deploymentId, String projectName, String commitSha,
                                  String branch, String status) {
        if (!enabled || evalForgeApiUrl == null || evalForgeApiUrl.isBlank()) {
            log.debug("EvalForge notifications disabled or URL not configured");
            return;
        }

        Map<String, Object> payload = Map.of(
                "deployment_id", deploymentId.toString(),
                "project_name", projectName,
                "commit_sha", commitSha != null ? commitSha : "unknown",
                "commit_branch", branch != null ? branch : "main",
                "status", status,
                "timestamp", Instant.now().toString()
        );

        String url = evalForgeApiUrl.stripTrailing() + "/api/v1/webhooks/dockops";

        webClient.post()
                .uri(url)
                .header("Content-Type", "application/json")
                .header("X-DockOps-Secret", webhookSecret != null ? webhookSecret : "")
                .header("X-DockOps-Project", projectName)
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofSeconds(10))
                .onErrorResume(e -> {
                    log.warn("EvalForge notification failed for deployment {}: {}", deploymentId, e.getMessage());
                    return Mono.empty();
                })
                .subscribe(response ->
                        log.info("EvalForge notified for deployment {} (project={}): {}", deploymentId, projectName, response)
                );
    }
}
