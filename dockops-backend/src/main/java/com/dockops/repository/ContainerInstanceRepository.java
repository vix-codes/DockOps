package com.dockops.repository;

import com.dockops.entity.ContainerInstance;
import com.dockops.entity.ServerNode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ContainerInstanceRepository extends JpaRepository<ContainerInstance, UUID> {
    List<ContainerInstance> findByServerNode(ServerNode serverNode);
    Optional<ContainerInstance> findByContainerIdAndServerNode(String containerId, ServerNode serverNode);
    void deleteByServerNode(ServerNode serverNode);
}
