package com.dockops.repository;

import com.dockops.entity.Deployment;
import com.dockops.entity.Project;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DeploymentRepository extends JpaRepository<Deployment, UUID> {
    Page<Deployment> findByProjectOrderByCreatedAtDesc(Project project, Pageable pageable);
    List<Deployment> findByProjectOrderByCreatedAtDesc(Project project);
    List<Deployment> findByStatus(Deployment.DeploymentStatus status);
    Optional<Deployment> findTopByProjectOrderByCreatedAtDesc(Project project);

    @Query("SELECT d FROM Deployment d WHERE d.project = :project AND d.status = 'SUCCESS' ORDER BY d.createdAt DESC")
    List<Deployment> findSuccessfulDeploymentsByProject(Project project, Pageable pageable);

    @Query("SELECT COUNT(d) FROM Deployment d WHERE d.project = :project AND d.status = :status")
    long countByProjectAndStatus(Project project, Deployment.DeploymentStatus status);
}
