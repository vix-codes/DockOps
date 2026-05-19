package com.dockops.repository;

import com.dockops.entity.ServerNode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ServerNodeRepository extends JpaRepository<ServerNode, UUID> {
    Optional<ServerNode> findByName(String name);
    List<ServerNode> findByStatus(ServerNode.NodeStatus status);
    boolean existsByName(String name);

    @Query("SELECT s FROM ServerNode s WHERE s.dockerAvailable = true AND s.status = 'ONLINE'")
    List<ServerNode> findActiveDockerNodes();
}
