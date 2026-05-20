package com.dockops.filesystem;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record FileEntry(
        String name,
        String path,
        String type,          // "file" | "directory" | "symlink"
        long size,
        String permissions,
        long lastModifiedEpoch,
        String linkTarget      // populated for symlinks
) {}
