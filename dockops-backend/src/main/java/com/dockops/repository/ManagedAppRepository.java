package com.dockops.repository;

import com.dockops.entity.ManagedApp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ManagedAppRepository extends JpaRepository<ManagedApp, UUID> {
    List<ManagedApp> findAllByOrderByDisplayNameAsc();
    Optional<ManagedApp> findByName(String name);
    boolean existsByName(String name);
}
