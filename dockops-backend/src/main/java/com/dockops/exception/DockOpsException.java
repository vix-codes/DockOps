package com.dockops.exception;

import org.springframework.http.HttpStatus;

public class DockOpsException extends RuntimeException {
    private final HttpStatus status;
    private final String errorCode;

    public DockOpsException(String message, HttpStatus status, String errorCode) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
    }

    public DockOpsException(String message, HttpStatus status) {
        this(message, status, status.name());
    }

    public HttpStatus getStatus() { return status; }
    public String getErrorCode() { return errorCode; }

    public static DockOpsException notFound(String resource, Object id) {
        return new DockOpsException(resource + " not found: " + id, HttpStatus.NOT_FOUND, "NOT_FOUND");
    }

    public static DockOpsException conflict(String message) {
        return new DockOpsException(message, HttpStatus.CONFLICT, "CONFLICT");
    }

    public static DockOpsException badRequest(String message) {
        return new DockOpsException(message, HttpStatus.BAD_REQUEST, "BAD_REQUEST");
    }

    public static DockOpsException unauthorized(String message) {
        return new DockOpsException(message, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
    }

    public static DockOpsException forbidden(String message) {
        return new DockOpsException(message, HttpStatus.FORBIDDEN, "FORBIDDEN");
    }

    public static DockOpsException sshError(String message) {
        return new DockOpsException("SSH error: " + message, HttpStatus.SERVICE_UNAVAILABLE, "SSH_ERROR");
    }
}
