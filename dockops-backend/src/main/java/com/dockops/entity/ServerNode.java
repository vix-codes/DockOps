package com.dockops.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "server_nodes")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ServerNode {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false)
    private String host;

    @Column(nullable = false)
    private int sshPort;

    @Column(nullable = false, length = 100)
    private String sshUser;

    @Column(columnDefinition = "TEXT")
    private String sshPassword;

    @Column(columnDefinition = "TEXT")
    private String sshPrivateKey;

    @Column(columnDefinition = "TEXT")
    private String sshPrivateKeyPassphrase;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AuthMethod authMethod;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private NodeStatus status = NodeStatus.UNKNOWN;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column
    private String environment;

    @Column
    private String os;

    @Column
    private String kernelVersion;

    @Column
    private Double cpuUsage;

    @Column
    private Double ramUsage;

    @Column
    private Double diskUsage;

    @Column
    private Long uptimeSeconds;

    @Column
    private Integer runningContainers;

    @Column
    private Boolean dockerAvailable;

    @Column
    private Instant lastCheckedAt;

    @CreatedDate
    @Column(updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    public enum AuthMethod {
        PASSWORD, PRIVATE_KEY
    }

    public enum NodeStatus {
        ONLINE, OFFLINE, UNKNOWN, ERROR
    }
}
