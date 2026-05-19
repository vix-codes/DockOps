package com.dockops.repository;

import com.dockops.entity.Project;
import com.dockops.entity.ServerNode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProjectRepository extends JpaRepository<Project, UUID> {
    List<Project> findByServerNode(ServerNode serverNode);
    List<Project> findByStatus(Project.ProjectStatus status);
    Optional<Project> findByWebhookSecret(String webhookSecret);
    boolean existsByName(String name);
}
