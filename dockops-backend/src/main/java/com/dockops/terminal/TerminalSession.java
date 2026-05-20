package com.dockops.terminal;

import com.jcraft.jsch.ChannelShell;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

@Slf4j
public class TerminalSession {

    @Getter
    private final String sessionId;
    @Getter
    private final WebSocketSession wsSession;
    private final ChannelShell shellChannel;
    private final OutputStream shellInput;
    private final InputStream shellOutput;

    public TerminalSession(String sessionId, WebSocketSession wsSession, ChannelShell shellChannel) throws IOException {
        this.sessionId = sessionId;
        this.wsSession = wsSession;
        this.shellChannel = shellChannel;
        this.shellInput = shellChannel.getOutputStream();
        this.shellOutput = shellChannel.getInputStream();
    }

    public OutputStream getShellInput() {
        return shellInput;
    }

    public InputStream getShellOutput() {
        return shellOutput;
    }

    public void resize(int cols, int rows) {
        try {
            shellChannel.setPtySize(cols, rows, cols * 8, rows * 16);
        } catch (Exception e) {
            log.warn("Resize failed for session {}: {}", sessionId, e.getMessage());
        }
    }

    public boolean isOpen() {
        return wsSession.isOpen() && shellChannel.isConnected();
    }

    public void close() {
        try {
            shellInput.close();
        } catch (IOException ignored) {}
        if (shellChannel.isConnected()) {
            shellChannel.disconnect();
        }
    }
}
