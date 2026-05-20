package com.dockops.terminal;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@Slf4j
public class TerminalSessionManager {

    private final Map<String, TerminalSession> sessions = new ConcurrentHashMap<>();

    public void register(TerminalSession session) {
        sessions.put(session.getSessionId(), session);
        log.info("Terminal session registered: {}", session.getSessionId());
    }

    public TerminalSession get(String sessionId) {
        return sessions.get(sessionId);
    }

    public void remove(String sessionId) {
        TerminalSession session = sessions.remove(sessionId);
        if (session != null) {
            session.close();
            log.info("Terminal session removed: {}", sessionId);
        }
    }

    public int activeCount() {
        return sessions.size();
    }
}
