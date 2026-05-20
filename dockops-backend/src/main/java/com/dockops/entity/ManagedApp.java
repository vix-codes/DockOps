package com.dockops.entity;

import com.dockops.converter.StringListConverter;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "managed_apps")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ManagedApp {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column(nullable = false, length = 200)
    private String displayName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "server_node_id")
    private ServerNode serverNode;

    // Comma-separated container name patterns to match (e.g. "resolvehub-backend,resolvehub-frontend")
    @Convert(converter = StringListConverter.class)
    @Column(name = "container_names", columnDefinition = "TEXT")
    @Builder.Default
    private List<String> containerNames = new ArrayList<>();

    @Column(name = "compose_file_path")
    private String composeFilePath;

    @Column(name = "compose_work_dir")
    private String composeWorkDir;

    @Column(name = "git_repo_url")
    private String gitRepoUrl;

    @Column(name = "git_branch", length = 100)
    private String gitBranch;

    @Convert(converter = StringListConverter.class)
    @Column(name = "tags", columnDefinition = "TEXT")
    @Builder.Default
    private List<String> tags = new ArrayList<>();

    @Builder.Default
    private boolean enabled = true;

    @CreatedDate
    @Column(updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
