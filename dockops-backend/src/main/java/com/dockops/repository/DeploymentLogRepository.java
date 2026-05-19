package com.dockops.repository;

import com.dockops.entity.Deployment;
import com.dockops.entity.DeploymentLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DeploymentLogRepository extends JpaRepository<DeploymentLog, UUID> {
    List<DeploymentLog> findByDeploymentOrderByTimestampAsc(Deployment deployment);
}
