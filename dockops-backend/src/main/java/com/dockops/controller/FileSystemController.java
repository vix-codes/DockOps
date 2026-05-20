package com.dockops.controller;

import com.dockops.filesystem.FileEntry;
import com.dockops.filesystem.FileSystemService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/fs")
@RequiredArgsConstructor
public class FileSystemController {

    private final FileSystemService fsService;

    @GetMapping("/{nodeId}/list")
    public ResponseEntity<List<FileEntry>> list(@PathVariable UUID nodeId,
                                                 @RequestParam(defaultValue = "/") String path) {
        return ResponseEntity.ok(fsService.listDirectory(nodeId, path));
    }

    @GetMapping("/{nodeId}/read")
    public ResponseEntity<Map<String, String>> read(@PathVariable UUID nodeId,
                                                     @RequestParam String path) {
        String content = fsService.readFile(nodeId, path);
        return ResponseEntity.ok(Map.of("content", content, "path", path));
    }

    @PutMapping("/{nodeId}/write")
    @PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
    public ResponseEntity<Void> write(@PathVariable UUID nodeId,
                                       @RequestParam String path,
                                       @RequestBody Map<String, String> body) {
        fsService.writeFile(nodeId, path, body.getOrDefault("content", ""));
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{nodeId}/download")
    public ResponseEntity<InputStreamResource> download(@PathVariable UUID nodeId,
                                                         @RequestParam String path) {
        InputStream stream = fsService.downloadFile(nodeId, path);
        String filename = Paths.get(path).getFileName().toString();
        String encodedName = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedName)
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(new InputStreamResource(stream));
    }

    @PostMapping("/{nodeId}/upload")
    @PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
    public ResponseEntity<Void> upload(@PathVariable UUID nodeId,
                                        @RequestParam String directory,
                                        @RequestParam("file") MultipartFile file) {
        fsService.uploadFile(nodeId, directory, file);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{nodeId}/mkdir")
    @PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
    public ResponseEntity<Void> mkdir(@PathVariable UUID nodeId,
                                       @RequestBody Map<String, String> body) {
        fsService.createDirectory(nodeId, body.get("path"));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{nodeId}/touch")
    @PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
    public ResponseEntity<Void> touch(@PathVariable UUID nodeId,
                                       @RequestBody Map<String, String> body) {
        fsService.createFile(nodeId, body.get("path"));
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/{nodeId}/rename")
    @PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
    public ResponseEntity<Void> rename(@PathVariable UUID nodeId,
                                        @RequestBody Map<String, String> body) {
        fsService.renameEntry(nodeId, body.get("oldPath"), body.get("newPath"));
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{nodeId}/delete")
    @PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
    public ResponseEntity<Void> delete(@PathVariable UUID nodeId,
                                        @RequestParam String path,
                                        @RequestParam(defaultValue = "false") boolean recursive) {
        fsService.deleteEntry(nodeId, path, recursive);
        return ResponseEntity.ok().build();
    }
}
