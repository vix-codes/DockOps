package com.dockops.scheduler;

import com.dockops.entity.ServerNode;
import com.dockops.repository.ServerNodeRepository;
import com.dockops.service.MetricsService;
import com.dockops.websocket.MetricsBroadcaster;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class MetricsScheduler {

    private final ServerNodeRepository serverNodeRepository;
    private final MetricsService metricsService;
    private final MetricsBroadcaster metricsBroadcaster;

    @Scheduled(fixedDelayString = "${app.metrics.collection-interval-ms:30000}")
    public void collectAndBroadcastMetrics() {
        List<ServerNode> nodes = serverNodeRepository.findAll();
        for (ServerNode node : nodes) {
            try {
                ServerNode updated = metricsService.collectMetrics(node);
                metricsBroadcaster.broadcastMetrics(updated);
            } catch (Exception e) {
                log.warn("Metrics collection failed for node {}: {}", node.getName(), e.getMessage());
            }
        }
    }
}
