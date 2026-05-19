package com.dockops.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class GeminiService {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Value("${app.gemini.api-key}")
    private String apiKey;

    @Value("${app.gemini.api-url}")
    private String apiUrl;

    public GeminiService(WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.webClient = webClientBuilder.build();
        this.objectMapper = objectMapper;
    }

    public String analyzeDeploymentFailure(String failureLog, String projectName, String commitHash) {
        if (apiKey == null || apiKey.isBlank()) {
            return "AI analysis unavailable: GEMINI_API_KEY not configured.";
        }

        String prompt = String.format("""
                You are a DevOps engineer analyzing a deployment failure.

                Project: %s
                Commit: %s

                Deployment failure log:
                ```
                %s
                ```

                Provide a concise analysis (max 200 words):
                1. Root cause of the failure
                2. Most likely fix
                3. Prevention recommendations

                Be specific and actionable. Focus on the error, not generic advice.
                """, projectName, commitHash, truncate(failureLog, 4000));

        return callGemini(prompt);
    }

    public String analyzeContainerCrash(String containerName, String logs) {
        if (apiKey == null || apiKey.isBlank()) {
            return "AI analysis unavailable: GEMINI_API_KEY not configured.";
        }

        String prompt = String.format("""
                Analyze this container crash for: %s

                Container logs:
                ```
                %s
                ```

                Provide a brief diagnosis (max 150 words):
                1. Why the container crashed
                2. Immediate remediation steps
                """, containerName, truncate(logs, 3000));

        return callGemini(prompt);
    }

    public String summarizeLogs(String logContent, String context) {
        if (apiKey == null || apiKey.isBlank()) {
            return "AI analysis unavailable: GEMINI_API_KEY not configured.";
        }

        String prompt = String.format("""
                Summarize these operational logs for: %s

                Logs:
                ```
                %s
                ```

                Provide:
                1. Key events summary (2-3 sentences)
                2. Any warnings or errors found
                3. Overall system health assessment
                """, context, truncate(logContent, 3000));

        return callGemini(prompt);
    }

    private String callGemini(String prompt) {
        try {
            Map<String, Object> requestBody = Map.of(
                    "contents", List.of(Map.of(
                            "parts", List.of(Map.of("text", prompt))
                    ))
            );

            String url = apiUrl + "?key=" + apiKey;

            String response = webClient.post()
                    .uri(url)
                    .header("Content-Type", "application/json")
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(30))
                    .onErrorResume(e -> {
                        log.error("Gemini API call failed: {}", e.getMessage());
                        return Mono.just("{\"error\": \"" + e.getMessage() + "\"}");
                    })
                    .block();

            JsonNode root = objectMapper.readTree(response);
            if (root.has("error")) {
                return "AI analysis failed: " + root.path("error").path("message").asText(root.path("error").asText());
            }

            return root.path("candidates")
                    .path(0)
                    .path("content")
                    .path("parts")
                    .path(0)
                    .path("text")
                    .asText("Analysis not available.");

        } catch (Exception e) {
            log.error("Failed to get Gemini analysis: {}", e.getMessage());
            return "AI analysis temporarily unavailable.";
        }
    }

    private String truncate(String text, int maxLength) {
        if (text == null) return "";
        return text.length() > maxLength ? text.substring(text.length() - maxLength) : text;
    }
}
