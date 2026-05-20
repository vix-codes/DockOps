package com.dockops.terminal;

import com.dockops.entity.ServerNode;
import com.dockops.exception.DockOpsException;
import com.dockops.repository.ServerNodeRepository;
import com.dockops.security.JwtTokenProvider;
import com.dockops.ssh.SshConnectionManager;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jcraft.jsch.ChannelShell;
import com.jcraft.jsch.JSchException;
import com.jcraft.jsch.Session;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Component
@RequiredArgsConstructor
@Slf4j
public class TerminalWebSocketHandler extends AbstractWebSocketHandler {

    private final TerminalSessionManager sessionManager;
    private final SshConnectionManager sshManager;
    private final ServerNodeRepository nodeRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final ObjectMapper objectMapper;

    private final ExecutorService readerPool = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "terminal-reader");
        t.setDaemon(true);
        return t;
    });

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String nodeId = extractQueryParam(session, "nodeId");
        String token = extractQueryParam(session, "token");

        if (nodeId == null) {
            session.close(CloseStatus.BAD_DATA.withReason("nodeId required"));
            return;
        }

        // Validate JWT
        if (token == null || !jwtTokenProvider.validateToken(token)) {
            session.close(CloseStatus.POLICY_VIOLATION.withReason("Invalid token"));
            return;
        }

        ServerNode node;
        try {
            node = nodeRepository.findById(UUID.fromString(nodeId))
                    .orElseThrow(() -> DockOpsException.notFound("Node", nodeId));
        } catch (Exception e) {
            session.close(CloseStatus.BAD_DATA.withReason("Node not found"));
            return;
        }

        try {
            Session sshSession = sshManager.getOrCreateSessionPublic(node);
            ChannelShell shell = (ChannelShell) sshSession.openChannel("shell");
            shell.setPtyType("xterm-256color");
            shell.setPtySize(220, 50, 220 * 8, 50 * 16);

            TerminalSession termSession = new TerminalSession(session.getId(), session, shell);
            shell.connect(10000);
            sessionManager.register(termSession);

            // Background thread: SSH output → WebSocket
            readerPool.submit(() -> pumpShellToWs(termSession));

            log.info("Terminal session started for node {} (wsId={})", node.getName(), session.getId());
        } catch (JSchException | IOException e) {
            log.error("Failed to open terminal session: {}", e.getMessage());
            session.close(CloseStatus.SERVER_ERROR.withReason("SSH connection failed"));
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        TerminalSession ts = sessionManager.get(session.getId());
        if (ts == null) return;

        String payload = message.getPayload();
        try {
            JsonNode json = objectMapper.readTree(payload);
            String type = json.path("type").asText();
            if ("resize".equals(type)) {
                int cols = json.path("cols").asInt(80);
                int rows = json.path("rows").asInt(24);
                ts.resize(cols, rows);
                return;
            }
            if ("ping".equals(type)) return;
        } catch (Exception ignored) {
            // Not JSON — treat as raw terminal input
        }
        writeToShell(ts, payload.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) throws Exception {
        TerminalSession ts = sessionManager.get(session.getId());
        if (ts == null) return;
        writeToShell(ts, message.getPayload().array());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessionManager.remove(session.getId());
        log.info("Terminal session closed: {} ({})", session.getId(), status);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.warn("Terminal transport error for {}: {}", session.getId(), exception.getMessage());
        sessionManager.remove(session.getId());
    }

    private void pumpShellToWs(TerminalSession ts) {
        byte[] buf = new byte[4096];
        InputStream in = ts.getShellOutput();
        try {
            int n;
            while (ts.isOpen() && (n = in.read(buf)) != -1) {
                if (n > 0) {
                    String data = new String(buf, 0, n, StandardCharsets.UTF_8);
                    synchronized (ts.getWsSession()) {
                        if (ts.getWsSession().isOpen()) {
                            ts.getWsSession().sendMessage(new TextMessage(data));
                        }
                    }
                }
            }
        } catch (IOException e) {
            if (ts.getWsSession().isOpen()) {
                log.debug("SSH output stream ended for {}: {}", ts.getSessionId(), e.getMessage());
            }
        } finally {
            sessionManager.remove(ts.getSessionId());
            try {
                if (ts.getWsSession().isOpen()) {
                    ts.getWsSession().close(CloseStatus.NORMAL);
                }
            } catch (IOException ignored) {}
        }
    }

    private void writeToShell(TerminalSession ts, byte[] data) {
        try {
            OutputStream out = ts.getShellInput();
            out.write(data);
            out.flush();
        } catch (IOException e) {
            log.warn("Failed to write to shell for {}: {}", ts.getSessionId(), e.getMessage());
        }
    }

    private String extractQueryParam(WebSocketSession session, String param) {
        String query = session.getUri() != null ? session.getUri().getQuery() : null;
        if (query == null) return null;
        for (String part : query.split("&")) {
            String[] kv = part.split("=", 2);
            if (kv.length == 2 && kv[0].equals(param)) return kv[1];
        }
        return null;
    }
}
