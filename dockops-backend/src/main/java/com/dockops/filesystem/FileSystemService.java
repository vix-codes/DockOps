package com.dockops.filesystem;

import com.dockops.entity.ServerNode;
import com.dockops.exception.DockOpsException;
import com.dockops.service.ServerNodeService;
import com.dockops.ssh.SshConnectionManager;
import com.jcraft.jsch.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class FileSystemService {

    private final SshConnectionManager sshManager;
    private final ServerNodeService serverNodeService;

    // Paths blocked from deletion to prevent catastrophic accidents
    private static final Set<String> PROTECTED_PATHS = Set.of(
            "/", "/bin", "/boot", "/dev", "/etc", "/lib", "/lib64",
            "/proc", "/run", "/sbin", "/sys", "/usr", "/var"
    );

    public List<FileEntry> listDirectory(UUID nodeId, String path) {
        String safePath = sanitizePath(path);
        ServerNode node = serverNodeService.findById(nodeId);
        ChannelSftp sftp = openSftp(node);
        try {
            List<FileEntry> entries = new ArrayList<>();
            @SuppressWarnings("unchecked")
            Vector<ChannelSftp.LsEntry> listing = sftp.ls(safePath);
            for (ChannelSftp.LsEntry entry : listing) {
                if (entry.getFilename().equals(".") || entry.getFilename().equals("..")) continue;
                SftpATTRS attrs = entry.getAttrs();
                String entryPath = safePath.endsWith("/")
                        ? safePath + entry.getFilename()
                        : safePath + "/" + entry.getFilename();
                String type = attrs.isDir() ? "directory" : attrs.isLink() ? "symlink" : "file";
                String linkTarget = null;
                if (attrs.isLink()) {
                    try { linkTarget = sftp.readlink(entryPath); } catch (SftpException ignored) {}
                }
                entries.add(new FileEntry(
                        entry.getFilename(),
                        entryPath,
                        type,
                        attrs.getSize(),
                        entry.getLongname().substring(0, 10),
                        attrs.getMTime() * 1000L,
                        linkTarget
                ));
            }
            entries.sort(Comparator.comparing((FileEntry e) -> !"directory".equals(e.type()))
                    .thenComparing(FileEntry::name, String.CASE_INSENSITIVE_ORDER));
            return entries;
        } catch (SftpException e) {
            throw DockOpsException.badRequest("Cannot list directory '" + safePath + "': " + e.getMessage());
        } finally {
            sftp.disconnect();
        }
    }

    public String readFile(UUID nodeId, String path) {
        String safePath = sanitizePath(path);
        ServerNode node = serverNodeService.findById(nodeId);
        ChannelSftp sftp = openSftp(node);
        try {
            SftpATTRS attrs = sftp.stat(safePath);
            if (attrs.isDir()) throw DockOpsException.badRequest("Path is a directory");
            if (attrs.getSize() > 2 * 1024 * 1024) {
                throw DockOpsException.badRequest("File too large to view in browser (max 2MB)");
            }
            try (InputStream in = sftp.get(safePath)) {
                return new String(in.readAllBytes(), StandardCharsets.UTF_8);
            }
        } catch (SftpException | IOException e) {
            throw DockOpsException.badRequest("Cannot read file '" + safePath + "': " + e.getMessage());
        } finally {
            sftp.disconnect();
        }
    }

    public void writeFile(UUID nodeId, String path, String content) {
        String safePath = sanitizePath(path);
        ServerNode node = serverNodeService.findById(nodeId);
        ChannelSftp sftp = openSftp(node);
        try {
            byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
            sftp.put(new ByteArrayInputStream(bytes), safePath, ChannelSftp.OVERWRITE);
        } catch (SftpException e) {
            throw DockOpsException.badRequest("Cannot write file '" + safePath + "': " + e.getMessage());
        } finally {
            sftp.disconnect();
        }
    }

    public InputStream downloadFile(UUID nodeId, String path) {
        String safePath = sanitizePath(path);
        ServerNode node = serverNodeService.findById(nodeId);
        ChannelSftp sftp = openSftp(node);
        try {
            return sftp.get(safePath);
        } catch (SftpException e) {
            sftp.disconnect();
            throw DockOpsException.badRequest("Cannot download file '" + safePath + "': " + e.getMessage());
        }
        // Caller is responsible for closing the stream (and sftp connection afterwards)
    }

    public void uploadFile(UUID nodeId, String directory, MultipartFile file) {
        String safePath = sanitizePath(directory);
        ServerNode node = serverNodeService.findById(nodeId);
        ChannelSftp sftp = openSftp(node);
        String fileName = Objects.requireNonNull(file.getOriginalFilename())
                .replaceAll("[^a-zA-Z0-9._\\-]", "_");
        String destPath = safePath.endsWith("/") ? safePath + fileName : safePath + "/" + fileName;
        try (InputStream in = file.getInputStream()) {
            sftp.put(in, destPath, ChannelSftp.OVERWRITE);
        } catch (SftpException | IOException e) {
            throw DockOpsException.badRequest("Upload failed: " + e.getMessage());
        } finally {
            sftp.disconnect();
        }
    }

    public void renameEntry(UUID nodeId, String oldPath, String newPath) {
        String safeOld = sanitizePath(oldPath);
        String safeNew = sanitizePath(newPath);
        ServerNode node = serverNodeService.findById(nodeId);
        ChannelSftp sftp = openSftp(node);
        try {
            sftp.rename(safeOld, safeNew);
        } catch (SftpException e) {
            throw DockOpsException.badRequest("Rename failed: " + e.getMessage());
        } finally {
            sftp.disconnect();
        }
    }

    public void createDirectory(UUID nodeId, String path) {
        String safePath = sanitizePath(path);
        ServerNode node = serverNodeService.findById(nodeId);
        ChannelSftp sftp = openSftp(node);
        try {
            sftp.mkdir(safePath);
        } catch (SftpException e) {
            throw DockOpsException.badRequest("Cannot create directory: " + e.getMessage());
        } finally {
            sftp.disconnect();
        }
    }

    public void createFile(UUID nodeId, String path) {
        String safePath = sanitizePath(path);
        ServerNode node = serverNodeService.findById(nodeId);
        ChannelSftp sftp = openSftp(node);
        try {
            sftp.put(new ByteArrayInputStream(new byte[0]), safePath, ChannelSftp.OVERWRITE);
        } catch (SftpException e) {
            throw DockOpsException.badRequest("Cannot create file: " + e.getMessage());
        } finally {
            sftp.disconnect();
        }
    }

    public void deleteEntry(UUID nodeId, String path, boolean recursive) {
        String safePath = sanitizePath(path);
        if (PROTECTED_PATHS.contains(safePath)) {
            throw DockOpsException.badRequest("Deletion of '" + safePath + "' is not permitted");
        }
        ServerNode node = serverNodeService.findById(nodeId);
        ChannelSftp sftp = openSftp(node);
        try {
            SftpATTRS attrs = sftp.stat(safePath);
            if (attrs.isDir()) {
                if (!recursive) throw DockOpsException.badRequest("Use recursive=true to delete directories");
                deleteDirectoryRecursive(sftp, safePath);
            } else {
                sftp.rm(safePath);
            }
        } catch (SftpException e) {
            throw DockOpsException.badRequest("Delete failed: " + e.getMessage());
        } finally {
            sftp.disconnect();
        }
    }

    private void deleteDirectoryRecursive(ChannelSftp sftp, String path) throws SftpException {
        @SuppressWarnings("unchecked")
        Vector<ChannelSftp.LsEntry> entries = sftp.ls(path);
        for (ChannelSftp.LsEntry entry : entries) {
            if (entry.getFilename().equals(".") || entry.getFilename().equals("..")) continue;
            String child = path + "/" + entry.getFilename();
            if (entry.getAttrs().isDir()) {
                deleteDirectoryRecursive(sftp, child);
            } else {
                sftp.rm(child);
            }
        }
        sftp.rmdir(path);
    }

    private ChannelSftp openSftp(ServerNode node) {
        try {
            Session session = sshManager.getOrCreateSessionPublic(node);
            ChannelSftp sftp = (ChannelSftp) session.openChannel("sftp");
            sftp.connect(10000);
            return sftp;
        } catch (JSchException e) {
            throw DockOpsException.sshError("SFTP channel failed: " + e.getMessage());
        }
    }

    private String sanitizePath(String path) {
        if (path == null || path.isBlank()) return "/";
        // Normalize — collapse // and resolve . and ..
        String normalized = path.replaceAll("//+", "/");
        String[] parts = normalized.split("/");
        Deque<String> stack = new ArrayDeque<>();
        for (String part : parts) {
            if (part.isEmpty() || part.equals(".")) continue;
            if (part.equals("..")) { if (!stack.isEmpty()) stack.pop(); }
            else stack.push(part);
        }
        StringBuilder sb = new StringBuilder("/");
        List<String> resolved = new ArrayList<>(stack);
        Collections.reverse(resolved);
        sb.append(String.join("/", resolved));
        return sb.toString().equals("/") ? "/" : sb.toString();
    }
}
