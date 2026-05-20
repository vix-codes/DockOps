import { useEffect, useRef, useState } from 'react';
import {
  Folder, File, ChevronRight, RefreshCw, Upload, Trash2,
  Pencil, Download, Save, X, FolderPlus, FilePlus, ArrowLeft,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fsApi, nodesApi } from '@/services/api';
import type { FileEntry, ServerNode } from '@/types';

function formatSize(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function fileIcon(entry: FileEntry) {
  if (entry.type === 'directory') return <Folder className="w-4 h-4 text-[hsl(var(--warning))]" />;
  return <File className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />;
}

export function FileBrowserPage() {
  const [nodes, setNodes] = useState<ServerNode[]>([]);
  const [nodeId, setNodeId] = useState('');
  const [path, setPath] = useState('/');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<FileEntry | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  const [showNewDir, setShowNewDir] = useState(false);
  const [showNewFile, setShowNewFile] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<FileEntry | null>(null);

  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nodesApi.list().then((r) => {
      setNodes(r.data);
      if (r.data.length > 0) setNodeId(r.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (nodeId) loadDir(path);
  }, [nodeId]);

  const loadDir = async (p: string) => {
    setLoading(true);
    setSelected(null);
    setFileContent(null);
    try {
      const res = await fsApi.list(nodeId, p);
      setEntries(res.data);
      setPath(p);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to list directory');
    } finally {
      setLoading(false);
    }
  };

  const openEntry = async (entry: FileEntry) => {
    if (entry.type === 'directory') {
      loadDir(entry.path);
      return;
    }
    setSelected(entry);
    setEditMode(false);
    try {
      const res = await fsApi.read(nodeId, entry.path);
      setFileContent(res.data.content);
    } catch {
      setFileContent(null);
    }
  };

  const saveFile = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await fsApi.write(nodeId, selected.path, editContent);
      setFileContent(editContent);
      setEditMode(false);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async (entry: FileEntry) => {
    try {
      await fsApi.delete(nodeId, entry.path, entry.type === 'directory');
      setConfirmDelete(null);
      setSelected(null);
      setFileContent(null);
      loadDir(path);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Delete failed');
    }
  };

  const doCreate = async (type: 'dir' | 'file') => {
    const target = path.endsWith('/') ? path + newName : path + '/' + newName;
    try {
      if (type === 'dir') await fsApi.mkdir(nodeId, target);
      else await fsApi.touch(nodeId, target);
      setNewName('');
      setShowNewDir(false);
      setShowNewFile(false);
      loadDir(path);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Create failed');
    }
  };

  const doRename = async () => {
    if (!selected) return;
    const parent = selected.path.substring(0, selected.path.lastIndexOf('/')) || '/';
    const newPath = parent + '/' + newName;
    try {
      await fsApi.rename(nodeId, selected.path, newPath);
      setShowRename(false);
      setNewName('');
      setSelected(null);
      loadDir(path);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Rename failed');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await fsApi.upload(nodeId, path, file);
      loadDir(path);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Upload failed');
    }
    if (uploadRef.current) uploadRef.current.value = '';
  };

  const breadcrumbs = path === '/' ? ['/'] : ['/', ...path.split('/').filter(Boolean)];
  const crumbPath = (i: number) => i === 0 ? '/' : '/' + breadcrumbs.slice(1, i + 1).join('/');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">File Browser</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Remote filesystem via SFTP</p>
        </div>
        <select
          className="bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md px-3 py-1.5 text-sm text-[hsl(var(--foreground))] focus:outline-none"
          value={nodeId}
          onChange={(e) => { setNodeId(e.target.value); setPath('/'); }}
        >
          {nodes.map((n) => <option key={n.id} value={n.id}>{n.name} ({n.host})</option>)}
        </select>
      </div>

      {/* Breadcrumb + toolbar */}
      <Card>
        <div className="flex items-center justify-between px-4 py-2 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-1 text-sm flex-wrap">
            {breadcrumbs.map((seg, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />}
                <button
                  onClick={() => loadDir(crumbPath(i))}
                  className="hover:text-[hsl(var(--primary))] transition-colors font-mono"
                >
                  {seg}
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {path !== '/' && (
              <Button variant="ghost" size="icon" title="Up" onClick={() => {
                const parent = path.substring(0, path.lastIndexOf('/')) || '/';
                loadDir(parent);
              }}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" title="Refresh" onClick={() => loadDir(path)}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" title="New folder" onClick={() => { setShowNewDir(true); setNewName(''); }}>
              <FolderPlus className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" title="New file" onClick={() => { setShowNewFile(true); setNewName(''); }}>
              <FilePlus className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" title="Upload file" onClick={() => uploadRef.current?.click()}>
              <Upload className="w-4 h-4" />
            </Button>
            <input ref={uploadRef} type="file" className="hidden" onChange={handleUpload} />
          </div>
        </div>

        <div className="flex" style={{ minHeight: '60vh' }}>
          {/* File list */}
          <div className="flex-1 overflow-y-auto border-r border-[hsl(var(--border))]">
            {loading ? (
              <div className="p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Loading…</div>
            ) : entries.length === 0 ? (
              <div className="p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Empty directory</div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {entries.map((e) => (
                    <tr
                      key={e.path}
                      onClick={() => openEntry(e)}
                      className={`flex items-center gap-3 px-4 py-2 cursor-pointer border-b border-[hsl(var(--border))]/50 hover:bg-[hsl(var(--secondary))]/50 ${selected?.path === e.path ? 'bg-[hsl(var(--primary))]/10' : ''}`}
                    >
                      <td className="flex-shrink-0">{fileIcon(e)}</td>
                      <td className="flex-1 font-mono truncate">{e.name}</td>
                      <td className="text-xs text-[hsl(var(--muted-foreground))] w-20 text-right font-mono">
                        {e.type !== 'directory' ? formatSize(e.size) : ''}
                      </td>
                      <td className="text-xs text-[hsl(var(--muted-foreground))] w-24 font-mono hidden md:block">
                        {e.permissions}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* File viewer / editor */}
          <div className="w-[45%] flex flex-col">
            {selected ? (
              <>
                <div className="flex items-center justify-between px-4 py-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30">
                  <span className="text-xs font-mono truncate text-[hsl(var(--muted-foreground))]">{selected.path}</span>
                  <div className="flex items-center gap-1">
                    {selected.type === 'file' && fileContent !== null && !editMode && (
                      <Button variant="ghost" size="icon" title="Edit" onClick={() => { setEditContent(fileContent); setEditMode(true); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {editMode && (
                      <>
                        <Button variant="ghost" size="icon" title="Save" onClick={saveFile} disabled={saving}>
                          <Save className="w-3.5 h-3.5 text-[hsl(var(--success))]" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Cancel" onClick={() => setEditMode(false)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                    {selected.type === 'file' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Download"
                        onClick={() => fsApi.download(nodeId, selected.path)}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" title="Rename" onClick={() => { setShowRename(true); setNewName(selected.name); }}>
                      <Pencil className="w-3.5 h-3.5 text-[hsl(var(--warning))]" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Delete" onClick={() => setConfirmDelete(selected)}>
                      <Trash2 className="w-3.5 h-3.5 text-[hsl(var(--destructive))]" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto">
                  {editMode ? (
                    <textarea
                      className="w-full h-full p-4 font-mono text-xs bg-[hsl(var(--background))] text-[hsl(var(--foreground))] resize-none focus:outline-none"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      spellCheck={false}
                    />
                  ) : fileContent !== null ? (
                    <pre className="p-4 text-xs font-mono leading-5 text-[hsl(var(--foreground))] whitespace-pre-wrap break-all">{fileContent}</pre>
                  ) : (
                    <div className="p-4 text-sm text-[hsl(var(--muted-foreground))]">
                      {selected.type === 'directory' ? 'Select a file to view its contents.' : 'Binary or unreadable file.'}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                Select a file to preview
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Inline modals */}
      {(showNewDir || showNewFile) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg p-5 w-80 space-y-3">
            <h2 className="text-sm font-semibold">{showNewDir ? 'New Folder' : 'New File'}</h2>
            <input
              autoFocus
              className="w-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none font-mono"
              placeholder={showNewDir ? 'folder-name' : 'filename.txt'}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doCreate(showNewDir ? 'dir' : 'file')}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowNewDir(false); setShowNewFile(false); }}>Cancel</Button>
              <Button size="sm" onClick={() => doCreate(showNewDir ? 'dir' : 'file')} disabled={!newName.trim()}>Create</Button>
            </div>
          </div>
        </div>
      )}

      {showRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg p-5 w-80 space-y-3">
            <h2 className="text-sm font-semibold">Rename</h2>
            <input
              autoFocus
              className="w-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none font-mono"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doRename()}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowRename(false)}>Cancel</Button>
              <Button size="sm" onClick={doRename} disabled={!newName.trim()}>Rename</Button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg p-5 w-80 space-y-3">
            <h2 className="text-sm font-semibold text-[hsl(var(--destructive))]">Confirm Delete</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Delete <span className="font-mono text-[hsl(var(--foreground))]">{confirmDelete.name}</span>
              {confirmDelete.type === 'directory' ? ' and all its contents?' : '?'}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={() => doDelete(confirmDelete)}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
