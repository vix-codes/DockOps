package com.dockops.ssh;

public record SshCommandResult(
        int exitCode,
        String stdout,
        String stderr,
        boolean success
) {
    public static SshCommandResult success(String stdout) {
        return new SshCommandResult(0, stdout, "", true);
    }

    public static SshCommandResult failure(int exitCode, String stderr) {
        return new SshCommandResult(exitCode, "", stderr, false);
    }

    public String output() {
        return stdout.isBlank() ? stderr : stdout;
    }
}
