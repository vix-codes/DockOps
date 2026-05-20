package com.dockops.ssh;

import com.dockops.entity.ServerNode;
import com.dockops.exception.DockOpsException;
import com.jcraft.jsch.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
@Slf4j
public class SshConnectionManager {

    @Value("${app.ssh.connection-timeout}")
    private int connectionTimeout;

    @Value("${app.ssh.session-timeout}")
    private int sessionTimeout;

    private final Map<UUID, Session> sessionPool = new ConcurrentHashMap<>();

    public SshCommandResult execute(ServerNode node, String command) {
        Session session = null;
        ChannelExec channel = null;
        try {
            session = getOrCreateSession(node);
            channel = (ChannelExec) session.openChannel("exec");
            channel.setCommand(command);

            ByteArrayOutputStream stdout = new ByteArrayOutputStream();
            ByteArrayOutputStream stderr = new ByteArrayOutputStream();
            channel.setOutputStream(stdout);
            channel.setErrStream(stderr);

            channel.connect(connectionTimeout);

            int waited = 0;
            while (!channel.isClosed() && waited < sessionTimeout) {
                Thread.sleep(100);
                waited += 100;
            }

            int exitCode = channel.getExitStatus();
            String stdoutStr = stdout.toString(StandardCharsets.UTF_8).trim();
            String stderrStr = stderr.toString(StandardCharsets.UTF_8).trim();

            log.debug("SSH [{}] exit={} cmd={}", node.getHost(), exitCode, command);
            return new SshCommandResult(exitCode, stdoutStr, stderrStr, exitCode == 0);

        } catch (JSchException | InterruptedException e) {
            log.error("SSH execution failed on {}: {}", node.getHost(), e.getMessage());
            invalidateSession(node.getId());
            throw DockOpsException.sshError("Command execution failed: " + e.getMessage());
        } finally {
            if (channel != null && !channel.isClosed()) {
                channel.disconnect();
            }
        }
    }

    public void streamExecute(ServerNode node, String command, LineConsumer consumer) {
        Session session = null;
        ChannelExec channel = null;
        try {
            session = getOrCreateSession(node);
            channel = (ChannelExec) session.openChannel("exec");
            channel.setCommand(command);

            InputStream inputStream = channel.getInputStream();
            channel.connect(connectionTimeout);

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    consumer.accept(line);
                }
            }
        } catch (JSchException | IOException e) {
            log.error("SSH stream failed on {}: {}", node.getHost(), e.getMessage());
            invalidateSession(node.getId());
            throw DockOpsException.sshError("Stream execution failed: " + e.getMessage());
        } finally {
            if (channel != null) channel.disconnect();
        }
    }

    public boolean testConnection(ServerNode node) {
        try {
            Session session = createSession(node);
            session.connect(connectionTimeout);
            session.disconnect();
            return true;
        } catch (JSchException e) {
            log.warn("Connection test failed for {}: {}", node.getHost(), e.getMessage());
            return false;
        }
    }

    private Session getOrCreateSession(ServerNode node) throws JSchException {
        Session existing = sessionPool.get(node.getId());
        if (existing != null && existing.isConnected()) {
            return existing;
        }
        Session session = createSession(node);
        session.connect(connectionTimeout);
        sessionPool.put(node.getId(), session);
        return session;
    }

    private Session createSession(ServerNode node) throws JSchException {
        JSch jsch = new JSch();

        if (node.getAuthMethod() == ServerNode.AuthMethod.PRIVATE_KEY && node.getSshPrivateKey() != null) {
            byte[] privateKey = node.getSshPrivateKey().getBytes(StandardCharsets.UTF_8);
            byte[] passphrase = node.getSshPrivateKeyPassphrase() != null
                    ? node.getSshPrivateKeyPassphrase().getBytes(StandardCharsets.UTF_8)
                    : null;
            jsch.addIdentity("key", privateKey, null, passphrase);
        }

        Session session = jsch.getSession(node.getSshUser(), node.getHost(), node.getSshPort());

        if (node.getAuthMethod() == ServerNode.AuthMethod.PASSWORD) {
            session.setPassword(node.getSshPassword());
        }

        session.setConfig("StrictHostKeyChecking", "no");
        session.setConfig("PreferredAuthentications", "publickey,password");
        session.setTimeout(sessionTimeout);
        return session;
    }

    public void invalidateSession(UUID nodeId) {
        Session session = sessionPool.remove(nodeId);
        if (session != null && session.isConnected()) {
            session.disconnect();
        }
    }

    public void closeAll() {
        sessionPool.values().forEach(session -> {
            if (session.isConnected()) session.disconnect();
        });
        sessionPool.clear();
    }

    @FunctionalInterface
    public interface LineConsumer {
        void accept(String line);
    }
}
